import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabaseClient'
import Button from '../UI/Button'
import { messages, patterns, validatePattern } from '../../lib/validation'
import { MOROCCO_CITIES } from '../../lib/moroccoCities'

function getLocalPhone(phone = '') {
  return phone.replace(/^\+212\s*/, '').replace(/\D/g, '').slice(-9)
}

const fetchCities = async () => {
  const { data, error } = await supabase
    .from('customer_cities')
    .select('name')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data.map((city) => city.name)
}

export default function CustomerForm({ customer, onSuccess, onCancel }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      ...(customer || { full_name: '', email: '', phone: '', address: '', city: '' }),
      phone_local: getLocalPhone(customer?.phone)
    }
  })
  const { data: managedCities } = useSWR('customer-cities-active', fetchCities)
  const cities = managedCities?.length ? managedCities : MOROCCO_CITIES

  useEffect(() => {
    reset({
      ...(customer || { full_name: '', email: '', phone: '', address: '', city: '' }),
      phone_local: getLocalPhone(customer?.phone)
    })
  }, [customer, reset])

  const availableCities = customer?.city && !cities.includes(customer.city)
    ? [customer.city, ...cities]
    : cities

  const onSubmit = async (values) => {
    try {
      const { phone_local, ...customerValues } = values
      const payload = {
        ...customerValues,
        phone: phone_local ? `+212${phone_local}` : null
      }
      const result = customer
        ? await supabase.from('customers').update(payload).eq('id', customer.id).select('id, full_name').single()
        : await supabase.from('customers').insert(payload).select('id, full_name').single()
      const { error } = result
      if (error) throw error
      toast.success(customer ? 'Client mis à jour' : 'Client créé')
      onSuccess?.(result.data)
    } catch (err) {
      const message = err.message.includes("Could not find the 'city' column")
        ? 'La colonne Ville manque dans Supabase. Appliquez la migration customer_city avant de sauvegarder.'
        : `Erreur : ${err.message}`
      toast.error(message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="form-control">
        <label className="label" htmlFor="full_name">
          <span className="label-text">Nom complet</span>
        </label>
        <input
          id="full_name"
          className="input input-bordered"
          {...register('full_name', {
            required: 'Le nom est requis',
            validate: (value) => validatePattern(value, patterns.text, messages.text)
          })}
          aria-invalid={!!errors.full_name}
        />
        {errors.full_name && <span className="text-error text-sm">{errors.full_name.message}</span>}
      </div>

      <div className="form-control">
        <label className="label" htmlFor="email">
          <span className="label-text">Email</span>
        </label>
        <input
          id="email"
          type="email"
          className="input input-bordered"
          {...register('email', {
            validate: (value) => validatePattern(value, patterns.email, messages.email)
          })}
          aria-invalid={!!errors.email}
        />
        {errors.email && <span className="text-error text-sm">{errors.email.message}</span>}
      </div>

      <div className="form-control">
        <label className="label" htmlFor="phone">
          <span className="label-text">Téléphone fixe</span>
        </label>
        <div className="join w-full">
          <span className="join-item flex items-center bg-base-200 px-3 font-mono text-sm">+212</span>
          <input
            id="phone_local"
            inputMode="numeric"
            maxLength={9}
            placeholder="5XXXXXXXX"
            className="input input-bordered join-item w-full"
            {...register('phone_local', {
              validate: (value) =>
                !value ||
                /^[0-9]{9}$/.test(value.trim()) ||
                'Saisissez exactement 9 chiffres après +212.'
            })}
            aria-invalid={!!errors.phone_local}
          />
        </div>
        {errors.phone_local && <span className="text-error text-sm">{errors.phone_local.message}</span>}
      </div>

      <div className="form-control">
        <label className="label" htmlFor="city">
          <span className="label-text">Ville</span>
        </label>
        <select
          id="city"
          className="select select-bordered"
          {...register('city', { required: 'La ville est requise' })}
          aria-invalid={!!errors.city}
        >
          <option value="">Sélectionnez une ville</option>
          {availableCities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        {errors.city && <span className="text-error text-sm">{errors.city.message}</span>}
      </div>

      <div className="form-control">
        <label className="label" htmlFor="address">
          <span className="label-text">Adresse</span>
        </label>
        <textarea
          id="address"
          className="textarea textarea-bordered"
          {...register('address', {
            validate: (value) => validatePattern(value, patterns.address, messages.address)
          })}
          aria-invalid={!!errors.address}
        />
        {errors.address && <span className="text-error text-sm">{errors.address.message}</span>}
      </div>

      <div className="modal-action">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {customer ? 'Enregistrer' : 'Créer'}
        </Button>
      </div>
    </form>
  )
}
