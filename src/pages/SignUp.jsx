import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/UI/Button'
import { messages, patterns, validatePattern } from '../lib/validation'

export default function SignUp() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm()

  const onSubmit = async ({ full_name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name } }
    })
    if (error) {
      toast.error(error.message)
      return
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name,
        role: 'vendeur'
      })
    }

    toast.success('Compte créé, vous pouvez vous connecter')
    navigate('/connexion')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title justify-center mb-2">Créer un compte</h1>
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
              {errors.full_name && (
                <span className="text-error text-sm">{errors.full_name.message}</span>
              )}
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
                  required: 'Email requis',
                  validate: (value) => validatePattern(value, patterns.email, messages.email)
                })}
                aria-invalid={!!errors.email}
              />
              {errors.email && <span className="text-error text-sm">{errors.email.message}</span>}
            </div>
            <div className="form-control">
              <label className="label" htmlFor="password">
                <span className="label-text">Mot de passe</span>
              </label>
              <input
                id="password"
                type="password"
                className="input input-bordered"
                {...register('password', { required: 'Mot de passe requis', minLength: 6 })}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <span className="text-error text-sm">{errors.password.message}</span>
              )}
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              S'inscrire
            </Button>
          </form>
          <p className="text-center text-sm mt-3">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="link link-primary">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
