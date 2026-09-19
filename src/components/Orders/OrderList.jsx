import { useEffect, useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Eye, Plus, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import Card from '../UI/Card'
import Button from '../UI/Button'
import DataTable from '../UI/DataTable'
import LoadingSkeleton from '../UI/LoadingSkeleton'
import ExportButton from '../UI/ExportButton'
import Modal from '../UI/Modal'
import OrderForm from './OrderForm'
import OrderQrModal from './OrderQrModal'
import { InvoicePreview } from '../Invoices/InvoiceList'

const STATUS_BADGE = {
  draft: 'badge-ghost',
  confirmé: 'badge-info',
  livré: 'badge-success',
  annulé: 'badge-error',
  retourné: 'badge-warning'
}

const PRIORITY_BADGE = {
  urgente: 'badge-error',
  haute: 'badge-warning',
  normale: 'badge-info',
  basse: 'badge-ghost'
}

const fetchOrders = async () => {
  const enrichedQuery = supabase
    .from('orders')
    .select('id, order_number, status, priority, properties, created_at, customers(full_name), order_items(total_price)')
    .order('created_at', { ascending: false })
  let { data, error } = await enrichedQuery

  // Keep existing orders readable while the priority migration is being deployed.
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    const fallback = await supabase
      .from('orders')
      .select('id, order_number, status, created_at, customers(full_name), order_items(total_price)')
      .order('created_at', { ascending: false })
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  return data.map((o) => ({
    ...o,
    priority: o.priority || 'normale',
    properties: o.properties || {},
    customer_name: o.customers?.full_name || '—',
    total: o.order_items.reduce((sum, i) => sum + Number(i.total_price), 0)
  }))
}

export default function OrderList() {
  const { data, isLoading, error, mutate } = useSWR('orders', fetchOrders)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [qrOrder, setQrOrder] = useState(null)
  const [invoicePreview, setInvoicePreview] = useState(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const selectableOrders = (data || []).filter((order) => !['livré', 'annulé'].includes(order.status))
  useEffect(() => {
    const channel = supabase
      .channel('orders-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => mutate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => mutate()
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          toast.error('Mise à jour temps réel indisponible. Les actions restent disponibles.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mutate])

  const changeStatus = async (order, status) => {
    if (!window.confirm(`Modifier la commande ${order.order_number} vers « ${status} » ? Le stock sera ajusté automatiquement.`)) return

    try {
      const { error: statusError } = await supabase.rpc('change_order_status_with_stock', {
        p_order_id: order.id,
        p_status: status
      })
      if (statusError) {
        toast.error(`Modification impossible : ${statusError.message}`)
        return
      }

      toast.success(`Commande mise à jour : ${status}`)
      await mutate()
    } catch (statusError) {
      const message = statusError instanceof TypeError
        ? 'Connexion Supabase impossible. Vérifiez la connexion réseau et actualisez la page.'
        : statusError.message
      toast.error(`Modification impossible : ${message || 'Erreur inconnue'}`)
    }
  }

  const changeSelectedStatus = async (status) => {
    const selectedOrders = selectableOrders.filter((order) => selectedIds.includes(order.id))
    if (!selectedOrders.length) return
    if (!window.confirm(`Modifier ${selectedOrders.length} commande(s) vers « ${status} » ? Le stock sera ajusté automatiquement.`)) return

    try {
      const { error: statusError } = await supabase.rpc('change_orders_status_with_stock', {
        p_order_ids: selectedOrders.map((order) => order.id),
        p_status: status
      })
      if (statusError) {
        toast.error(`Modification impossible : ${statusError.message}`)
        return
      }
      setSelectedIds([])
      toast.success(`${selectedOrders.length} commande(s) mise(s) à jour`)
      await mutate()
    } catch (statusError) {
      toast.error(`Modification impossible : ${statusError.message || 'Connexion Supabase indisponible'}`)
    }
  }

  const openInvoicePreview = async (order) => {
    setInvoiceLoading(true)
    try {
      const [{ data: orderDetails, error: orderError }, { data: invoice, error: invoiceError }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, created_at, customers(full_name, phone, email, address), order_items(id, quantity, unit_price, total_price, products(name, sku))')
          .eq('id', order.id)
          .single(),
        supabase
          .from('invoices')
          .select('id, amount, created_at')
          .eq('order_id', order.id)
          .maybeSingle()
      ])

      if (orderError) throw orderError
      if (invoiceError) throw invoiceError

      const calculatedAmount = (orderDetails.order_items || []).reduce(
        (sum, item) => sum + Number(item.total_price || item.quantity * item.unit_price || 0),
        0
      )
      setInvoicePreview({
        id: invoice?.id || orderDetails.id,
        amount: invoice?.amount ?? calculatedAmount,
        created_at: invoice?.created_at || orderDetails.created_at,
        orders: orderDetails
      })
    } catch (previewError) {
      toast.error(`Aperçu impossible : ${previewError.message || 'Erreur inconnue'}`)
    } finally {
      setInvoiceLoading(false)
    }
  }

  const columns = [
    { key: 'order_number', label: 'N° commande', render: (r) => r.order_number },
    {
      key: 'selection',
      label: '',
      render: (r) => (
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          disabled={['livré', 'annulé'].includes(r.status)}
          checked={selectedIds.includes(r.id)}
          onChange={() => setSelectedIds((current) => current.includes(r.id)
            ? current.filter((id) => id !== r.id)
            : [...current, r.id])}
          aria-label={`Sélectionner la commande ${r.order_number}`}
        />
      )
    },
    { key: 'customer_name', label: 'Client' },
    {
      key: 'priority',
      label: 'Priorité',
      render: (r) => <span className={`badge ${PRIORITY_BADGE[r.priority] || 'badge-ghost'}`}>{r.priority || 'normale'}</span>
    },
    {
      key: 'status',
      label: 'Statut',
      render: (r) => <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status}</span>
    },
    { key: 'total', label: 'Total', render: (r) => `${r.total.toFixed(2)} DH` },
    {
      key: 'created_at',
      label: 'Date',
      render: (r) => new Date(r.created_at).toLocaleDateString('fr-FR')
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1">
          <select className="select select-bordered select-xs" value={r.status}
            disabled={['livré', 'annulé'].includes(r.status)}
            aria-label={`Modifier le statut de la commande ${r.order_number}`}
            onChange={(event) => changeStatus(r, event.target.value)}>
            <option value="draft">Brouillon</option>
            <option value="confirmé">Confirmée</option>
            <option value="annulé">Annulée</option>
            <option value="retourné">Retournée</option>
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            aria-label={`Aperçu de la facture ${r.order_number}`}
            title="Aperçu de la facture"
            onClick={() => openInvoicePreview(r)}
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      )
    },
    {
      key: 'qr',
      label: 'QR',
      render: (r) => (
        <button
          className="btn btn-ghost btn-xs"
          aria-label={`Générer le QR de ${r.order_number}`}
          onClick={() => setQrOrder(r)}
        >
          <QrCode className="h-4 w-4" />
          QR
        </button>
      )
    }
  ]

  return (
    <Card
      title="Commandes"
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={selectedIds.length !== 1 || invoiceLoading}
            onClick={() => {
              const selectedOrder = (data || []).find((order) => order.id === selectedIds[0])
              if (selectedOrder) openInvoicePreview(selectedOrder)
            }}
          >
            <Eye className="h-4 w-4" />
            {invoiceLoading ? 'Chargement...' : 'Aperçu facture'}
          </Button>
          {selectableOrders.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selectableOrders.length > 0 && selectableOrders.every((order) => selectedIds.includes(order.id))}
                onChange={(event) => setSelectedIds(event.target.checked ? selectableOrders.map((order) => order.id) : [])}
                aria-label="Sélectionner les commandes modifiables"
              />
              Toutes
            </label>
          )}
          {selectedIds.length > 0 && (
            <select
              className="select select-bordered select-sm"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) changeSelectedStatus(event.target.value)
                event.target.value = ''
              }}
            >
              <option value="" disabled>Changer l’état ({selectedIds.length})</option>
              <option value="draft">Brouillon</option>
              <option value="confirmé">Confirmée</option>
              <option value="livré">Livrée</option>
              <option value="annulé">Annulée</option>
              <option value="retourné">Retournée</option>
            </select>
          )}
          <ExportButton data={data || []} columns={columns} filename="commandes" />
          <Button
            onClick={() => setModalOpen(true)}
          >
            <Plus className="w-4 h-4" /> Nouvelle commande
          </Button>
        </>
      }
    >
      {isLoading && <LoadingSkeleton />}
      {error && <p className="text-error">Erreur de chargement des commandes.</p>}
      {data && <DataTable columns={columns} data={data} emptyLabel="Aucune commande pour le moment" />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle commande">
        <OrderForm
          onSuccess={() => {
            setModalOpen(false)
            mutate()
            toast.success('Commande créée et stock mis à jour')
          }}
        />
      </Modal>
      <OrderQrModal order={qrOrder} onClose={() => setQrOrder(null)} />
      <Modal
        open={!!invoicePreview}
        onClose={() => setInvoicePreview(null)}
        title="Aperçu de la facture"
      >
        {invoicePreview && <InvoicePreview invoice={invoicePreview} />}
      </Modal>
    </Card>
  )
}
