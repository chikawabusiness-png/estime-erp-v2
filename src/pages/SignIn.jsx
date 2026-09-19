import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/UI/Button'

export default function SignIn() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm()

  const onSubmit = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Bienvenue !')
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <img
            src="/estime-logo.png"
            alt="Estime Parfum"
            className="mx-auto mb-2 h-32 w-auto object-contain"
          />
          <h1 className="card-title justify-center mb-2">Parfumerie ERP</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="form-control">
              <label className="label" htmlFor="email">
                <span className="label-text">Email</span>
              </label>
              <input
                id="email"
                type="email"
                className="input input-bordered"
                {...register('email', { required: 'Email requis' })}
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
                {...register('password', { required: 'Mot de passe requis' })}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <span className="text-error text-sm">{errors.password.message}</span>
              )}
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Se connecter
            </Button>
          </form>
          <p className="text-center text-sm mt-3">
            Pas de compte ?{' '}
            <Link to="/inscription" className="link link-primary">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
