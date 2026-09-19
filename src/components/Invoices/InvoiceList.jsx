import useSWR from 'swr'
import { useState } from 'react'
import { CalendarDays, Download, Eye, FileText, Mail, Plus, Printer, ScanLine, Search, Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabaseClient'
import LoadingSkeleton from '../UI/LoadingSkeleton'
import ExportButton from '../UI/ExportButton'
import Modal from '../UI/Modal'
import Button from '../UI/Button'
import ProductQrScanner from '../Products/ProductQrScanner'
import CustomerForm from '../Customers/CustomerForm'

const fetchInvoices = async () => {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id,
      amount,
      pdf_path,
      created_at,
      orders(
        id,
        order_number,
        status,
        customers(full_name, phone, email, address),
        order_items(quantity, unit_price, total_price, products(name, sku))
      )
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((inv) => ({
    ...inv,
    order_number: inv.orders?.order_number || '—',
    customer_name: inv.orders?.customers?.full_name || '—',
    status: ['livrée', 'livree', 'livré', 'livre'].includes(String(inv.orders?.status || '').toLowerCase())
      ? 'Payée'
      : ['annulée', 'annulee', 'annulé', 'annule'].includes(String(inv.orders?.status || '').toLowerCase())
        ? 'Annulée'
        : 'En attente'
  }))
}

const fetchInvoiceOptions = async () => {
  const [{ data: customers, error: customersError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from('customers').select('id, full_name').order('full_name'),
    supabase.from('products').select('id, sku, name, price, stock').order('name')
  ])
  if (customersError) throw customersError
  if (productsError) throw productsError
  return { customers: customers || [], products: products || [] }
}

function ManualInvoiceForm({ options, onCreated, onClose, refreshOptions }) {
  const [customerId, setCustomerId] = useState('')
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }])
  const [scannerOpen, setScannerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const products = options?.products || []
  const productMap = new Map(products.map((product) => [product.id, product]))
  const totalCents = items.reduce((sum, item) => {
    const product = productMap.get(item.product_id)
    return sum + (product ? Math.round(Number(product.price) * 100) * Number(item.quantity || 0) : 0)
  }, 0)
  const total = totalCents / 100

  const updateItem = (index, changes) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
  }

  const addProduct = (productId) => {
    const existingIndex = items.findIndex((item) => item.product_id === productId)
    if (existingIndex >= 0) {
      updateItem(existingIndex, { quantity: Number(items[existingIndex].quantity) + 1 })
      return
    }
    const emptyIndex = items.findIndex((item) => !item.product_id)
    if (emptyIndex >= 0) updateItem(emptyIndex, { product_id: productId })
    else setItems((current) => [...current, { product_id: productId, quantity: 1 }])
  }

  const handleScan = (payload) => {
    const reference = String(payload.sku || payload.product_code || payload.id || '').trim().toLowerCase()
    const product = products.find((item) => [item.sku, item.id, item.name].some((value) => String(value || '').toLowerCase() === reference))
    setScannerOpen(false)
    if (!product) {
      toast.error('Produit introuvable dans le catalogue.')
      return
    }
    addProduct(product.id)
    toast.success(`${product.name} ajouté à la facture.`)
  }

  const submit = async (event) => {
    event.preventDefault()
    const validItems = items.map((item) => ({ ...item, quantity: Number(item.quantity) })).filter((item) => item.product_id && item.quantity > 0)
    if (!validItems.length) return toast.error('Ajoutez au moins un produit.')
    if (validItems.some((item) => item.quantity > Number(productMap.get(item.product_id)?.stock || 0))) return toast.error('La quantité dépasse le stock disponible.')
    setSubmitting(true)
    try {
      const { error: invoiceError } = await supabase.rpc('create_manual_invoice', {
        p_customer_id: customerId || null,
        p_items: validItems.map(({ product_id, quantity }) => ({ product_id, quantity }))
      })
      if (invoiceError) throw invoiceError
      toast.success('Facture manuelle créée.')
      onCreated()
    } catch (error) {
      toast.error(`Erreur : ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4">
        <div className="form-control">
          <label className="label" htmlFor="manual-invoice-customer"><span className="label-text">Client</span></label>
          <div className="flex gap-2">
            <select id="manual-invoice-customer" className="select select-bordered flex-1" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Client de passage</option>
              {(options?.customers || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
            </select>
            <button type="button" className="btn btn-outline btn-square" onClick={() => setCustomerModalOpen(true)} aria-label="Ajouter un client">
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">Articles</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setScannerOpen(true)}><ScanLine className="h-4 w-4" /> Scanner un QR</button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => {
            const product = productMap.get(item.product_id)
            return <div key={`${index}-${item.product_id}`} className="flex items-end gap-2">
              <select className="select select-bordered select-sm min-w-0 flex-1" value={item.product_id} onChange={(event) => updateItem(index, { product_id: event.target.value })} aria-label="Produit">
                <option value="">Choisir un produit</option>
                {products.map((option) => <option key={option.id} value={option.id} disabled={option.stock <= 0}>{option.name} · {option.sku || '—'} · {Number(option.price).toFixed(2)} DH</option>)}
              </select>
              <input type="number" min="1" className="input input-bordered input-sm w-20" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} aria-label="Quantité" />
              <span className="w-24 text-right text-sm">{product ? `${(Number(product.price) * Number(item.quantity || 0)).toFixed(2)} DH` : '—'}</span>
              <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1} aria-label="Retirer la ligne"><Trash2 className="h-4 w-4" /></button>
            </div>
          })}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems((current) => [...current, { product_id: '', quantity: 1 }])}><Plus className="h-4 w-4" /> Ajouter une ligne</button>
        <div className="flex items-center justify-between border-t border-base-300 pt-3 font-semibold">Total <span>{total.toFixed(2)} DH</span></div>
        <div className="modal-action"><button type="button" className="btn btn-outline" onClick={onClose}>Annuler</button><Button type="submit" loading={submitting}>Créer la facture</Button></div>
      </form>
      <ProductQrScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
      <Modal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} title="Nouveau client">
        <CustomerForm
          onSuccess={async (customer) => {
            await refreshOptions()
            setCustomerId(customer.id)
            setCustomerModalOpen(false)
            toast.success(`${customer.full_name} sélectionné.`)
          }}
          onCancel={() => setCustomerModalOpen(false)}
        />
      </Modal>
    </>
  )
}

export default function InvoiceList() {
  const { data, isLoading, error, mutate } = useSWR('invoices', fetchInvoices)
  const { data: options, mutate: refreshOptions } = useSWR('manual-invoice-options', fetchInvoiceOptions)
  const invoices = data || []
  const latestInvoice = invoices[0]
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Toutes')
  const [dateFilter, setDateFilter] = useState('Toutes')
  const [selectedDate, setSelectedDate] = useState('')
  const [clientFilter, setClientFilter] = useState('Tous')

  const clients = [...new Set(invoices.map((invoice) => invoice.customer_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))

  const filteredInvoices = invoices.filter((invoice) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [
      invoice.order_number,
      invoice.customer_name,
      `FAC-${invoice.id.slice(0, 6).toUpperCase()}`
    ].some((value) => String(value).toLowerCase().includes(query))
    const matchesStatus = statusFilter === 'Toutes' || invoice.status === statusFilter
    const matchesClient = clientFilter === 'Tous' || invoice.customer_name === clientFilter
    const invoiceDate = new Date(invoice.created_at)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfWeek.getDate() - 7)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const invoiceDay = invoiceDate.toISOString().slice(0, 10)
    const matchesDate = dateFilter === 'Toutes'
      || (dateFilter === 'Date précise' && selectedDate && invoiceDay === selectedDate)
      || (dateFilter === "Aujourd'hui" && invoiceDate >= startOfToday)
      || (dateFilter === '7 derniers jours' && invoiceDate >= startOfWeek)
      || (dateFilter === 'Ce mois-ci' && invoiceDate >= startOfMonth)
    return matchesSearch && matchesStatus && matchesClient && matchesDate
  })
  const filteredTotal = filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)

  const columns = [
    { key: 'id', label: 'N° facture', render: (r) => `FAC-${r.id.slice(0, 6).toUpperCase()}` },
    { key: 'order_number', label: 'Commande' },
    { key: 'customer_name', label: 'Client' },
    { key: 'amount', label: 'Montant', render: (r) => `${Number(r.amount).toFixed(2)} DH` },
    { key: 'status', label: 'Statut' },
    {
      key: 'created_at',
      label: 'Date',
      render: (r) => new Date(r.created_at).toLocaleDateString('fr-FR')
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-1">
          <button className="btn btn-ghost btn-xs" onClick={() => setSelectedInvoice(r)} aria-label="Voir la facture">
            <Eye className="h-4 w-4" />
          </button>
          {r.pdf_path ? (
          <a
            href={
              supabase.storage.from('invoices').getPublicUrl(r.pdf_path).data.publicUrl
            }
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-xs"
            aria-label="Télécharger la facture PDF"
          >
            <Download className="w-4 h-4" />
          </a>
          ) : null}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-5">
      {isLoading && <LoadingSkeleton />}
      {error && <p className="text-error">Erreur de chargement des factures.</p>}
      {!isLoading && !error && (
        <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,2.2fr)]">
          <aside className="saas-card flex flex-col justify-between bg-base-200 p-5">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h1 className="text-lg font-bold">Dernière facture émise</h1>
                <FileText className="h-8 w-8 text-primary/40" />
              </div>
              {latestInvoice ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-base-content/60">N° facture</p>
                  <p className="mt-1 text-xl font-extrabold tracking-tight">FAC-{latestInvoice.id.slice(0, 6).toUpperCase()}</p>
                  <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-xs text-base-content/55">Client</p><p className="mt-1 font-semibold">{latestInvoice.customer_name}</p></div>
                    <div><p className="text-xs text-base-content/55">Montant</p><p className="mt-1 font-semibold">{Number(latestInvoice.amount).toFixed(2)} DH</p></div>
                  </div>
                  <span className={`saas-pill mt-5 inline-flex ${latestInvoice.status === 'Payée' ? 'bg-success/15 text-success' : latestInvoice.status === 'Annulée' ? 'bg-error/15 text-error' : 'bg-warning/20 text-warning-content'}`}>
                    {latestInvoice.status}
                  </span>
                </>
              ) : <p className="text-sm text-base-content/60">Aucune facture disponible.</p>}
            </div>
            {latestInvoice && <div className="mt-8 grid grid-cols-2 gap-2">
              <Button type="button" className="w-full" onClick={() => setSelectedInvoice(latestInvoice)}><Eye className="h-4 w-4" /> Voir</Button>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedInvoice(latestInvoice)}><Printer className="h-4 w-4" /> Imprimer</button>
            </div>}
          </aside>

          <section className="saas-card min-w-0 bg-base-200 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-bold">Liste détaillée des factures</h2><p className="mt-1 text-sm text-base-content/60">{filteredInvoices.length} facture{filteredInvoices.length > 1 ? 's' : ''} affichée{filteredInvoices.length > 1 ? 's' : ''}</p></div>
              <div className="flex flex-wrap gap-2">
                <ExportButton data={filteredInvoices} columns={columns.slice(0, 6)} filename="factures" />
                <Button type="button" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" /> Nouvelle facture</Button>
              </div>
            </div>
            <div className="mb-5 grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto_auto]">
              <label className="input input-bordered flex items-center gap-2 bg-base-100"><Search className="h-4 w-4 text-base-content/50" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher" aria-label="Rechercher une facture" /></label>
              <label className="select select-bordered flex items-center gap-2"><CalendarDays className="h-4 w-4 text-base-content/50" /><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filtrer par date"><option>Toutes</option><option>Date précise</option><option>Aujourd'hui</option><option>7 derniers jours</option><option>Ce mois-ci</option></select></label>
              {dateFilter === 'Date précise' && <label className="input input-bordered flex min-w-0 items-center gap-2 bg-base-100 text-sm"><input className="min-w-0 flex-1 bg-transparent" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Choisir une date" /></label>}
              <select className="select select-bordered" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} aria-label="Filtrer par client"><option value="Tous">Tous les clients</option>{clients.map((client) => <option key={client} value={client}>{client}</option>)}</select>
              <select className="select select-bordered" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrer par statut"><option>Toutes</option><option>Payée</option><option>En attente</option><option>Annulée</option></select>
            </div>
            <div className="table-responsive">
              <table className="saas-table w-full min-w-[760px]">
                <thead><tr><th>N° facture</th><th>Date</th><th>Client</th><th>Commande</th><th>Montant</th><th>Statut</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {filteredInvoices.map((invoice) => <tr key={invoice.id}>
                    <td className="font-semibold">FAC-{invoice.id.slice(0, 6).toUpperCase()}</td>
                    <td>{new Date(invoice.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="font-medium">{invoice.customer_name}</td>
                    <td className="font-mono text-xs">{invoice.order_number}</td>
                    <td className="font-semibold">{Number(invoice.amount).toFixed(2)} DH</td>
                    <td><span className={`saas-pill ${invoice.status === 'Payée' ? 'bg-success/15 text-success' : invoice.status === 'Annulée' ? 'bg-error/15 text-error' : 'bg-warning/20 text-warning-content'}`}>{invoice.status}</span></td>
                    <td><div className="flex justify-end gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedInvoice(invoice)} aria-label="Voir la facture"><Eye className="h-4 w-4" /></button>
                      {invoice.pdf_path && <a href={supabase.storage.from('invoices').getPublicUrl(invoice.pdf_path).data.publicUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" aria-label="Télécharger la facture PDF"><Download className="h-4 w-4" /></a>}
                      <button className="btn btn-ghost btn-sm" onClick={() => toast.success('La fonction d’envoi sera disponible après configuration email.')} aria-label="Envoyer la facture"><Mail className="h-4 w-4" /></button>
                    </div></td>
                  </tr>)}
                </tbody>
              </table>
              {!filteredInvoices.length && <div className="py-10 text-center text-sm text-base-content/60">Aucune facture ne correspond aux filtres.</div>}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-base-content/10 pt-3 text-sm text-base-content/60"><span>{filteredInvoices.length} sur {invoices.length}</span><span>Total : <strong className="text-base-content">{filteredTotal.toFixed(2)} DH</strong></span></div>
          </section>
        </div>
      )}
      <Modal
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Aperçu de la facture"
      >
        {selectedInvoice && <InvoicePreview invoice={selectedInvoice} />}
      </Modal>
      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Nouvelle facture manuelle">
        <p className="mb-4 text-sm opacity-70">Sélectionnez les articles ou scannez leurs QR pour remplir rapidement la facture.</p>
        <ManualInvoiceForm options={options} refreshOptions={refreshOptions} onCreated={() => { setManualOpen(false); mutate() }} onClose={() => setManualOpen(false)} />
      </Modal>
    </div>
  )
}

export function InvoicePreview({ invoice }) {
  const paymentMethods = ['Virement bancaire', 'Carte bancaire', 'Espèces', 'Paiement à la livraison']
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Paiement à la livraison')
  const [paymentNote, setPaymentNote] = useState('Paiement à la livraison / à la réception de la commande.')
  const order = invoice.orders
  const customer = order?.customers
  const items = order?.order_items || []
  const total = Number(invoice.amount || items.reduce((sum, item) => sum + Number(item.total_price || 0), 0))
  const invoiceNumber = `FAC-${invoice.id.slice(0, 6).toUpperCase()}`

  return (
    <div className="invoice-paper mx-auto space-y-3" id="invoice-preview">
      <div className="flex items-start justify-between gap-2 border-b border-base-300 pb-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight">facture</p>
          <p className="mt-1 rounded bg-base-200 px-2 py-1 font-mono text-xs">{invoiceNumber}</p>
        </div>
        <div className="text-right text-xs">
          <p><strong>DATE</strong> : {new Date(invoice.created_at).toLocaleDateString('fr-FR')}</p>
          <p><strong>COMMANDE</strong> : {order?.order_number || '—'}</p>
        </div>
      </div>

      <div className="grid gap-1 text-xs sm:grid-cols-2">
        <div>
          <p className="font-semibold uppercase">Client</p>
          <p>{customer?.full_name || '—'}</p>
        </div>
        <div>
          <p className="font-semibold uppercase">Contact</p>
          <p>{customer?.phone || customer?.email || '—'}</p>
        </div>
        <div>
          <p className="font-semibold uppercase">Adresse</p>
          <p>{customer?.address || '—'}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-base-300">
        <table className="table table-xs">
          <thead>
            <tr>
              <th>Qté</th>
              <th>Désignation</th>
              <th className="text-right">Prix unit. HT</th>
              <th className="text-right">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item) => (
              <tr key={item.id || `${item.products?.sku}-${item.quantity}`}>
                <td>{item.quantity}</td>
                <td>{item.products?.name || item.products?.sku || 'Produit'}</td>
                <td className="text-right">{Number(item.unit_price || 0).toFixed(2)} DH</td>
                <td className="text-right">{Number(item.total_price || item.quantity * item.unit_price || 0).toFixed(2)} DH</td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="text-center">Aucun article détaillé</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ml-auto max-w-[210px] space-y-1 text-right text-xs">
        <p>Montant HT <span className="ml-8">{total.toFixed(2)} DH</span></p>
        <p>TVA <span className="ml-16">0,00 DH</span></p>
        <p className="mt-3 rounded-lg border-2 border-base-content px-3 py-3 text-lg font-bold">
          TOTAL TTC <span className="ml-2">{total.toFixed(2)} DH</span>
        </p>
      </div>

      <div className="border-t border-base-300 pt-3 text-xs">
        <p className="font-semibold uppercase">Conditions et modalités de paiement</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 print-payment-methods">
          {paymentMethods.map((method) => (
            <label key={method} className="flex items-center gap-1">
              <input
                type="radio"
                className="radio radio-xs"
                name={`payment-method-${invoice.id}`}
                value={method}
                checked={selectedPaymentMethod === method}
                onChange={() => setSelectedPaymentMethod(method)}
              />
              <span>{method}</span>
            </label>
          ))}
        </div>
        <textarea
          className="invoice-payment-note mt-3 w-full resize-y rounded border border-base-300 bg-base-100 p-2 text-xs text-base-content/70"
          value={paymentNote}
          onChange={(event) => setPaymentNote(event.target.value)}
          aria-label="Condition de paiement"
          rows={2}
        />
      </div>

      <div className="flex justify-end print:hidden">
        <Button type="button" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimer
        </Button>
      </div>
    </div>
  )
}
