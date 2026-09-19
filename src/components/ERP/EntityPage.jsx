import { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Pencil, Plus, QrCode, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import Card from '../UI/Card'
import Button from '../UI/Button'
import DataTable from '../UI/DataTable'
import LoadingSkeleton from '../UI/LoadingSkeleton'
import Modal from '../UI/Modal'
import { messages, patterns, validatePattern } from '../../lib/validation'
import EntityQrModal from '../UI/EntityQrModal'

const DELIVERY_STATUS_BADGE = {
  pending: 'badge-warning',
  dispatched: 'badge-info',
  delivered: 'badge-success',
  cancelled: 'badge-neutral'
}

const RELATION_TYPES = {
  order: 'orders',
  product: 'products',
  supplier: 'suppliers',
  material: 'raw_materials'
}

const RELATION_LABELS = {
  order: 'Commande',
  product: 'Produit',
  supplier: 'Fournisseur',
  material: 'Matière'
}

const getReferenceCode = (type, index, row) => {
  if (type === 'order') return row.order_number
  if (type === 'product' && row.sku) return row.sku
  const prefix = type === 'product' ? 'PRD' : type === 'supplier' ? 'SUP' : 'MAT'
  return `${prefix}-${String(index + 1).padStart(4, '0')}`
}

const fieldInput = (field, options = [], values = {}) => (
  <div className="form-control" key={field.key}>
    <label className="label" htmlFor={field.key}>
      <span className="label-text">{field.label}</span>
    </label>
    {field.type === 'select' || RELATION_TYPES[field.type] ? (
      <select id={field.key} name={field.key} className="select select-bordered" required={field.required} defaultValue={values[field.key] ?? ''}>
        <option value="" disabled>
          Sélectionner {RELATION_LABELS[field.type]?.toLowerCase() || 'une valeur'}...
        </option>
        {(RELATION_TYPES[field.type] ? options[field.type] || [] : field.options).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ) : field.type === 'textarea' ? (
      <textarea id={field.key} name={field.key} className="textarea textarea-bordered" required={field.required} defaultValue={values[field.key] ?? ''} />
    ) : (
      <input
        id={field.key}
        name={field.key}
        type={field.type || 'text'}
        className="input input-bordered"
        step={field.type === 'number' ? '0.01' : undefined}
        pattern={field.type === 'uuid' ? '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}' : undefined}
        placeholder={field.type === 'uuid' ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : field.placeholder}
        defaultValue={values[field.key] ?? ''}
        min={field.type === 'number' ? 0 : undefined}
        onInput={(event) => {
          if (field.type === 'number' && event.currentTarget.value < 0) event.currentTarget.value = ''
        }}
        required={field.required}
        readOnly={field.readOnly}
        aria-readonly={field.readOnly || undefined}
      />
    )}
  </div>
)

export default function EntityPage({ title, table, fields, columns = fields, qr }) {
  const { data, error, isLoading, mutate } = useSWR(
    table,
    async () => {
      const { data: rows, error: fetchError } = await supabase.from(table).select('*').order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      return rows
    }
  )
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qrEntity, setQrEntity] = useState(null)
  const relationTypes = [...new Set(fields.map((field) => field.type).filter((type) => RELATION_TYPES[type]))]
  const { data: relationOptions = {} } = useSWR(
    relationTypes.length ? `entity-relation-options-${relationTypes.join('-')}` : null,
    async () => {
      const options = {}
      for (const type of relationTypes) {
        const tableName = RELATION_TYPES[type]
        const select = type === 'order'
          ? 'id, order_number, created_at'
          : type === 'product'
            ? 'id, sku, name, volume_ml, stock, created_at'
            : type === 'supplier'
              ? 'id, name, created_at'
              : 'id, name, created_at'
        const { data: rows, error: rowsError } = await supabase
          .from(tableName)
          .select(select)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
        if (rowsError) throw rowsError

        options[type] = rows.map((row, index) => {
          const code = getReferenceCode(type, index, row)
          return { value: row.id, label: code }
        })
      }
      return options
    }
  )
  const create = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload = Object.fromEntries(
      [...form.entries()].filter(([key, value]) => value !== '' && !fields.find((field) => field.key === key)?.readOnly)
    )
    const invalid = fields.find((field) => {
      const value = String(payload[field.key] || '').trim()
      if (!value) return field.required
      if (field.type === 'uuid') return !patterns.uuid.test(value)
      if (field.type === 'email') return !patterns.email.test(value)
      if (field.type === 'phone') return !patterns.phone.test(value)
      if (field.type === 'number') return Number.isNaN(Number(value)) || Number(value) < 0
      if (field.type === 'address') return !patterns.address.test(value)
      if (field.type === 'text') return !patterns.text.test(value)
      return false
    })
    if (invalid) {
      toast.error(invalid.type === 'uuid' ? messages.uuid : `Valeur invalide : ${invalid.label}`)
      return
    }
    for (const field of fields) {
      if (field.type === 'number' && payload[field.key] !== '') payload[field.key] = Number(payload[field.key])
    }
    const { error: insertError } = editing
      ? await supabase.from(table).update(payload).eq('id', editing.id)
      : await supabase.from(table).insert(payload)
    if (insertError) {
      toast.error(`Erreur : ${insertError.message}`)
      return
    }

    if (table === 'deliveries' && payload.status === 'delivered' && payload.order_id) {
      const { error: orderSyncError } = await supabase
        .from('orders')
        .update({ status: 'livré', updated_at: new Date().toISOString() })
        .eq('id', payload.order_id)
        .not('status', 'in', '("livré","annulé","retourné")')

      if (orderSyncError) {
        toast.error(`Livraison enregistrée, mais synchronisation de la commande impossible : ${orderSyncError.message}`)
        return
      }
    }

    toast.success(editing ? 'Élément modifié' : `${title.slice(0, -1) || title} créé`)
    setOpen(false)
    setEditing(null)
    mutate()
  }

  const remove = async (row) => {
    if (!window.confirm('Supprimer cet élément ?')) return
    const { error: deleteError } = await supabase.from(table).delete().eq('id', row.id)
    if (deleteError) {
      toast.error(`Suppression impossible : ${deleteError.message}`)
      return
    }
    toast.success('Élément supprimé')
    mutate()
  }

  const tableColumns = [
    ...columns.map((field) => ({
      key: field.key,
      label: field.label,
      render: RELATION_TYPES[field.type]
        ? (row) => {
            const relation = relationOptions[field.type]?.find((option) => option.value === row[field.key])
            return relation ? relation.label : 'Référence introuvable'
          }
        : table === 'deliveries' && field.key === 'status'
          ? (row) => (
              <span className={`badge ${DELIVERY_STATUS_BADGE[row[field.key]] || 'badge-ghost'}`}>
                {field.options.find((option) => option.value === row[field.key])?.label || row[field.key]}
              </span>
            )
        : undefined
    })),
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-1">
          {qr && (
            <button className="btn btn-ghost btn-xs" onClick={() => setQrEntity(row)} aria-label="Générer le code QR">
              <QrCode className="w-4 h-4" />
            </button>
          )}
          <button className="btn btn-ghost btn-xs" onClick={() => { setEditing(row); setOpen(true) }} aria-label="Modifier">
            <Pencil className="w-4 h-4" />
          </button>
          <button className="btn btn-ghost btn-xs text-error" onClick={() => remove(row)} aria-label="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  return (
    <Card
      title={title}
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      }
    >
      {isLoading && <LoadingSkeleton />}
      {error && <p className="text-error">Erreur de chargement : {error.message}</p>}
      {data && <DataTable columns={tableColumns} data={data} emptyLabel={`Aucun élément dans ${title.toLowerCase()}`} />}
      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? `Modifier dans ${title}` : `Ajouter dans ${title}`}>
        <form onSubmit={create} className="space-y-3">
          {fields.map((field) => fieldInput(field, relationOptions, editing || {}))}
          <div className="modal-action">
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
      {qr && (
        <EntityQrModal
          entity={qrEntity}
          type={qr.type}
          title={`Code QR — ${title}`}
          fields={qr.fields}
          onClose={() => setQrEntity(null)}
        />
      )}
    </Card>
  )
}
