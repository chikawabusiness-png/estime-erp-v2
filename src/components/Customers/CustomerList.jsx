import { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Plus, Pencil, QrCode, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import Card from '../UI/Card'
import Button from '../UI/Button'
import DataTable from '../UI/DataTable'
import LoadingSkeleton from '../UI/LoadingSkeleton'
import ExportButton from '../UI/ExportButton'
import Modal from '../UI/Modal'
import CustomerForm from './CustomerForm'
import EntityQrModal from '../UI/EntityQrModal'

const fetchCustomers = async () => {
  const { data, error } = await supabase.from('customers').select('*').order('full_name')
  if (error) throw error
  return data
}

export default function CustomerList() {
  const { data, isLoading, error, mutate } = useSWR('customers', fetchCustomers)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qrCustomer, setQrCustomer] = useState(null)
  const handleDelete = async (customer) => {
    if (!window.confirm(`Supprimer "${customer.full_name}" ?`)) return
    const { error: delError } = await supabase.from('customers').delete().eq('id', customer.id)
    if (delError) {
      toast.error(`Suppression impossible : ${delError.message}`)
      return
    }
    toast.success('Client supprimé')
    mutate()
  }

  const columns = [
    { key: 'full_name', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'address', label: 'Adresse' },
    { key: 'city', label: 'Ville' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-xs" onClick={() => setQrCustomer(r)} aria-label={`Générer le QR de ${r.full_name}`}>
            <QrCode className="w-4 h-4" />
          </button>
          <button
            className="btn btn-ghost btn-xs"
            aria-label={`Modifier ${r.full_name}`}
            onClick={() => {
              setEditing(r)
              setModalOpen(true)
            }}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="btn btn-ghost btn-xs text-error"
            aria-label={`Supprimer ${r.full_name}`}
            onClick={() => handleDelete(r)}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  return (
    <Card
      title="Clients"
      actions={
        <>
          <ExportButton data={data || []} columns={columns.slice(0, 5)} filename="clients" />
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="w-4 h-4" /> Nouveau client
          </Button>
        </>
      }
    >
      {isLoading && <LoadingSkeleton />}
      {error && <p className="text-error">Erreur de chargement des clients.</p>}
      {data && <DataTable columns={columns} data={data} emptyLabel="Aucun client pour le moment" />}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le client' : 'Nouveau client'}
      >
        <CustomerForm
          customer={editing}
          onSuccess={() => {
            setModalOpen(false)
            mutate()
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
      <EntityQrModal
        entity={qrCustomer}
        type="customer"
        title="Code QR — Client"
        fields={['full_name', 'phone', 'email', 'address']}
        onClose={() => setQrCustomer(null)}
      />
    </Card>
  )
}
