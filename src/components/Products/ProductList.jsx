import { useEffect, useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Plus, Pencil, QrCode, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import Card from '../UI/Card'
import Button from '../UI/Button'
import DataTable from '../UI/DataTable'
import LoadingSkeleton from '../UI/LoadingSkeleton'
import ExportButton from '../UI/ExportButton'
import Modal from '../UI/Modal'
import ProductForm from './ProductForm'
import ProductQrModal from './ProductQrModal'

const fetchProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').order('name')
  if (error) throw error
  return data
}

export default function ProductList() {
  const { isAdmin } = useAuth()
  const { data, isLoading, error, mutate } = useSWR('products', fetchProducts)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qrProduct, setQrProduct] = useState(null)

  useEffect(() => {
    const channel = supabase
      .channel('products-stock-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => mutate()
      )
      .subscribe()

    const refreshOnFocus = () => mutate()
    window.addEventListener('focus', refreshOnFocus)

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      supabase.removeChannel(channel)
    }
  }, [mutate])
  const handleDelete = async (product) => {
    if (!window.confirm(`Supprimer "${product.name}" ?`)) return
    const { error: delError } = await supabase.from('products').delete().eq('id', product.id)
    if (delError) {
      if (delError.code === '23503' && delError.message.includes('order_items_product_id_fkey')) {
        toast.error('Ce produit est utilisé dans une commande et ne peut pas être supprimé. Modifiez-le ou conservez-le pour garder l’historique.')
        return
      }
      toast.error(`Suppression impossible : ${delError.message}`)
      return
    }
    toast.success('Produit supprimé')
    mutate()
  }

  const columns = [
    { key: 'name', label: 'Nom' },
    { key: 'sku', label: 'SKU' },
    { key: 'price', label: 'Prix', render: (r) => `${Number(r.price).toFixed(2)} DH` },
    {
      key: 'stock',
      label: 'Stock',
      render: (r) => (
        <span className={r.stock <= (r.fixed_min_stock ?? 0) ? 'text-error font-semibold' : ''}>
          {r.stock} / {r.fixed_min_stock ?? 0}
        </span>
      )
    },
    {
      key: 'qr',
      label: 'QR',
      render: (r) => (
        <button
          className="btn btn-ghost btn-xs"
          aria-label={`Générer le code QR de ${r.name}`}
          onClick={() => setQrProduct(r)}
        >
          <QrCode className="h-4 w-4" />
          QR
        </button>
      )
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost btn-xs"
                  aria-label={`Modifier ${r.name}`}
                  onClick={() => {
                    setEditing(r)
                    setModalOpen(true)
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="btn btn-ghost btn-xs text-error"
                  aria-label={`Supprimer ${r.name}`}
                  onClick={() => handleDelete(r)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          }
        ]
      : [])
  ]

  return (
    <Card
      title="Produits"
      actions={
        <>
          <ExportButton data={data || []} columns={columns.slice(0, 4)} filename="produits" />
          {isAdmin && (
            <Button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
            >
              <Plus className="w-4 h-4" /> Nouveau produit
            </Button>
          )}
        </>
      }
    >
      {isLoading && <LoadingSkeleton />}
      {error && <p className="text-error">Erreur de chargement des produits.</p>}
      {data && <DataTable columns={columns} data={data} emptyLabel="Aucun produit pour le moment" />}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le produit' : 'Nouveau produit'}
      >
        <ProductForm
          product={editing}
          onSuccess={() => {
            setModalOpen(false)
            mutate()
          }}
        />
      </Modal>
      <ProductQrModal product={qrProduct} onClose={() => setQrProduct(null)} />
    </Card>
  )
}
