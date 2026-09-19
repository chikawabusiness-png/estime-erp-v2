import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Plus, QrCode, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import Button from '../UI/Button'
import Modal from '../UI/Modal'
import CustomerForm from '../Customers/CustomerForm'
import ProductQrScanner from '../Products/ProductQrScanner'
import { patterns } from '../../lib/validation'

const fetchOptions = async () => {
  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase.from('customers').select('id, full_name').order('full_name'),
    supabase.from('products').select('id, sku, name, price, stock').order('name')
  ])
  return { customers: customers || [], products: products || [] }
}

// Calls the deployed Edge Function to atomically decrement stock and
// log the corresponding stock_movements row.
async function callAdjustStock({ product_id, delta, comment }) {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: product_id,
    p_delta: delta,
    p_comment: comment
  })
  if (error) throw error
  return data
/*
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/adjust_stock`

  const res = await fetch(functionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ product_id, delta, comment })
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Échec de la mise à jour du stock')
  }
  return json.new_stock */
}

export default function OrderForm({ onSuccess }) {
  const { data: options, mutate: refreshOptions } = useSWR('order-form-options', fetchOptions)
  const [submitting, setSubmitting] = useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [scannerIndex, setScannerIndex] = useState(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: {
      customer_id: '',
      priority: 'normale',
      priority_reason: '',
      items: [{ product_id: '', quantity: 1 }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')

  const productMap = new Map((options?.products || []).map((p) => [p.id, p]))

  const total = items.reduce((sum, it) => {
    const p = productMap.get(it.product_id)
    return sum + (p ? p.price * (Number(it.quantity) || 0) : 0)
  }, 0)

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: values.customer_id || null,
          status: 'confirmé',
          priority: values.priority,
          properties: {
            priority: {
              level: values.priority,
              reason: values.priority_reason?.trim() || null,
              set_at: new Date().toISOString()
            }
          },
          created_by: user.id
        })
        .select('id, order_number')
        .single()
      if (orderError) throw orderError

      for (const item of values.items) {
        const product = productMap.get(item.product_id)
        if (!product) continue
        const quantity = Number(item.quantity)

        const { error: itemError } = await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.product_id,
          quantity,
          unit_price: product.price
        })
        if (itemError) throw itemError

        await callAdjustStock({
          product_id: item.product_id,
          delta: -quantity,
          comment: `Commande ${order.order_number}`
        })
      }

      onSuccess?.()
    } catch (err) {
      toast.error(`Erreur : ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="form-control">
        <label className="label" htmlFor="customer_id">
          <span className="label-text">Client</span>
        </label>
        <div className="flex gap-2">
          <select id="customer_id" className="select select-bordered flex-1" {...register('customer_id')}>
            <option value="">Client de passage</option>
            {options?.customers.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
          <button type="button" className="btn btn-outline btn-square" onClick={() => setCustomerModalOpen(true)} aria-label="Ajouter un client">
            <UserPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="form-control">
          <label className="label" htmlFor="priority">
            <span className="label-text">Priorité</span>
          </label>
          <select id="priority" className="select select-bordered" {...register('priority', { required: true })}>
            <option value="urgente">Urgente</option>
            <option value="haute">Haute</option>
            <option value="normale">Normale</option>
            <option value="basse">Basse</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label" htmlFor="priority_reason">
            <span className="label-text">Motif de priorité</span>
          </label>
          <input
            id="priority_reason"
            className="input input-bordered"
            placeholder="Ex. livraison urgente"
            {...register('priority_reason')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <span className="label-text">Articles</span>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-end">
            <div className="form-control flex-1">
              <div className="mb-1 flex gap-1">
                <input
                  className="input input-bordered input-xs min-w-0 flex-1"
                  placeholder="SKU / code série"
                  aria-label={`Code série article ${index + 1}`}
                  onChange={(event) => {
                    const code = event.target.value.trim().toLowerCase()
                    const match = options?.products.find((product) => product.sku?.toLowerCase() === code)
                    if (match) setValue(`items.${index}.product_id`, match.id, { shouldValidate: true })
                  }}
                />
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setScannerIndex(index)} aria-label={`Scanner le QR de l'article ${index + 1}`}>
                  <QrCode className="h-3.5 w-3.5" />
                </button>
              </div>
              <select
                className="select select-bordered select-sm"
                {...register(`items.${index}.product_id`, {
                  required: 'Sélectionnez un produit',
                  pattern: { value: patterns.uuid, message: 'Produit invalide' }
                })}
                aria-label="Produit"
              >
                <option value="">Choisir un produit</option>
                {options?.products.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                    {p.name} ({p.stock} en stock) — {p.price} DH
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control w-24">
              <input
                type="number"
                min="1"
                className="input input-bordered input-sm"
                {...register(`items.${index}.quantity`, {
                  required: 'La quantité est requise',
                  min: { value: 1, message: 'La quantité doit être supérieure à zéro' },
                  valueAsNumber: true
                })}
                aria-label="Quantité"
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              onClick={() => remove(index)}
              aria-label="Retirer cette ligne"
              disabled={fields.length === 1}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {errors.items && <span className="text-error text-sm">Vérifiez les lignes d'articles</span>}
        <Button
          type="button"
          variant="ghost"
          className="btn-sm"
          onClick={() => append({ product_id: '', quantity: 1 })}
        >
          <Plus className="w-4 h-4" /> Ajouter une ligne
        </Button>
      </div>

      <div className="flex justify-between items-center border-t border-base-300 pt-3">
        <span className="font-semibold">Total : {total.toFixed(2)} DH</span>
      </div>

      <div className="modal-action">
        <Button type="submit" loading={submitting}>
          Créer la commande
        </Button>
      </div>
      <Modal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} title="Nouveau client">
        <CustomerForm
          onSuccess={async (customer) => {
            await refreshOptions()
            setValue('customer_id', customer.id, { shouldValidate: true })
            setCustomerModalOpen(false)
          }}
          onCancel={() => setCustomerModalOpen(false)}
        />
      </Modal>
      <ProductQrScanner
        open={scannerIndex !== null}
        onClose={() => setScannerIndex(null)}
        onScan={(payload) => {
          const reference = String(payload.sku || payload.product_code || payload.id || '').trim().toLowerCase()
          const product = (options?.products || []).find((item) =>
            [item.sku, item.id, item.name].some((value) => String(value || '').toLowerCase() === reference)
          )
          if (!product) {
            toast.error('Produit introuvable pour ce QR.')
            return
          }
          setValue(`items.${scannerIndex}.product_id`, product.id, { shouldValidate: true })
          setScannerIndex(null)
          toast.success(`${product.name} ajouté à la commande.`)
        }}
      />
    </form>
  )
}
