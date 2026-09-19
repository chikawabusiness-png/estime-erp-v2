import { LogOut, Menu, Settings } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import Avatar from '../UI/Avatar'
import ThemeToggle from '../UI/ThemeToggle'
import BrandingSettings from './BrandingSettings'
import { useBranding } from '../../hooks/useBranding'

export default function Header({ onOpenSidebar }) {
  const { profile, user, role, signOut } = useAuth()
  const { branding } = useBranding()
  const [brandingOpen, setBrandingOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut()
      toast.success('Déconnexion réussie')
    } catch (err) {
      toast.error(`Erreur lors de la déconnexion : ${err.message}`)
    }
  }

  return (
    <header className="navbar min-h-[4.5rem] border-b border-base-300 bg-base-200 px-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          className="btn btn-ghost btn-circle lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img
          src={branding.logo}
          alt="Estime Parfum"
          className="h-9 w-auto object-contain sm:h-11"
        />
        {branding.showTextInHeader && (
          <span className="hidden truncate text-base font-semibold sm:block sm:text-lg">{branding.text}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="flex items-center gap-1 border-r border-base-300 pr-2 sm:gap-2 sm:pr-4">
          <ThemeToggle />
          <button
            className="btn btn-ghost btn-circle"
            onClick={() => setBrandingOpen(true)}
            aria-label="Personnaliser le logo et le texte"
            title="Personnaliser le logo et le texte"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 pl-1 sm:gap-3 sm:pl-2">
          <Avatar src={profile?.avatar_url} name={profile?.full_name || user?.email} size={9} />
          <div className="hidden min-w-0 max-w-[15rem] flex-col leading-tight sm:flex">
            <span className="truncate text-sm font-semibold">{profile?.full_name || user?.email}</span>
            {role && (
              <span
                className={`mt-0.5 w-fit text-xs capitalize ${role === 'admin' ? 'badge badge-primary' : 'text-base-content/60'}`}
              >
                {role}
              </span>
            )}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-circle"
          onClick={handleLogout}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
      <BrandingSettings open={brandingOpen} onClose={() => setBrandingOpen(false)} />
    </header>
  )
}
