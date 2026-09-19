import { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import DataTable from '../components/UI/DataTable'
import LoadingSkeleton from '../components/UI/LoadingSkeleton'
import Modal from '../components/UI/Modal'

const fetchCities = async () => {
  const { data, error } = await supabase.from('customer_cities').select('*').order('name')
  if (error) throw error
  return data
}

export default function CityManagement() {
  const { data, error, isLoading, mutate } = useSWR('customer-cities-admin', fetchCities)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)

  const save = async (event) => {
    event.preventDefault()
    const name = new FormData(event.currentTarget).get('name')?.toString().trim()
    if (!name || name.length < 2) {
      toast.error('Saisissez un nom de ville valide.')
      return
    }

    const query = editing
      ? supabase.from('customer_cities').update({ name }).eq('id', editing.id)
      : supabase.from('customer_cities').insert({ name })
    const { error: saveError } = await query
    if (saveError) {
      toast.error(`Enregistrement impossible : ${saveError.message}`)
      return
    }
    toast.success(editing ? 'Ville modifiée' : 'Ville ajoutée')
    setOpen(false)
    setEditing(null)
    mutate()
  }

  const toggle = async (city) => {
    const { error: updateError } = await supabase
      .from('customer_cities')
      .update({ active: !city.active })
      .eq('id', city.id)
    if (updateError) {
      toast.error(`Modification impossible : ${updateError.message}`)
      return
    }
    mutate()
  }

  const remove = async (city) => {
    if (!window.confirm(`Supprimer la ville « ${city.name} » ?`)) return
    const { error: deleteError } = await supabase.from('customer_cities').delete().eq('id', city.id)
    if (deleteError) {
      toast.error(`Suppression impossible : ${deleteError.message}`)
      return
    }
    toast.success('Ville supprimée')
    mutate()
  }

  const columns = [
    { key: 'name', label: 'Ville' },
    {
      key: 'active',
      label: 'État',
      render: (city) => (
        <button className={`badge ${city.active ? 'badge-success' : 'badge-ghost'}`} onClick={() => toggle(city)}>
          {city.active ? 'Actif' : 'Inactif'}
        </button>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (city) => (
        <div className="flex gap-1">
          <button className="btn btn-ghost btn-xs" onClick={() => { setEditing(city); setOpen(true) }} aria-label={`Modifier ${city.name}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button className="btn btn-ghost btn-xs text-error" onClick={() => remove(city)} aria-label={`Supprimer ${city.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ]

  return (
    <Card
      title="Gestion des villes"
      actions={
        <Button onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus className="h-4 w-4" /> Ajouter une ville
        </Button>
      }
    >
      {isLoading && <LoadingSkeleton />}
      {error && <p className="text-error">Erreur de chargement : {error.message}</p>}
      {data && <DataTable columns={columns} data={data} emptyLabel="Aucune ville configurée" />}
      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? 'Modifier la ville' : 'Ajouter une ville'}>
        <form onSubmit={save} className="space-y-3">
          <div className="form-control">
            <label className="label" htmlFor="city-name"><span className="label-text">Nom de la ville</span></label>
            <input id="city-name" name="name" defaultValue={editing?.name || ''} className="input input-bordered" required minLength={2} maxLength={80} />
          </div>
          <div className="modal-action">
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
