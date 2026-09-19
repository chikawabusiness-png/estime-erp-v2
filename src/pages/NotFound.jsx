import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-200">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-base-content/60">Cette page n'existe pas.</p>
      <Link to="/" className="btn btn-primary">
        Retour au tableau de bord
      </Link>
    </div>
  )
}
