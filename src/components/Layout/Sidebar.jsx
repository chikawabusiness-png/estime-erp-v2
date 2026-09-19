import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  ClipboardList,
  Warehouse,
  UserCog,
  WalletCards,
  Truck,
  CreditCard,
  MapPin,
  X
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const LINKS = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, adminOnly: false },
  { to: '/clients', label: 'Clients', icon: Users, adminOnly: false },
  { to: '/commandes', label: 'Commandes', icon: ShoppingCart, adminOnly: false },
  { to: '/stock-production', label: 'Stock & Production', icon: Warehouse, adminOnly: false },
  { to: '/employes', label: 'Employés', icon: UserCog, adminOnly: true },
  { to: '/depenses', label: 'Dépenses', icon: WalletCards, adminOnly: true },
  { to: '/paiements', label: 'Paiements', icon: CreditCard, adminOnly: true },
  { to: '/livraisons-retours', label: 'Livraisons & Retours', icon: Truck, adminOnly: false },
  { to: '/factures', label: 'Facturation', icon: FileText, adminOnly: false },
  { to: '/villes', label: 'Villes', icon: MapPin, adminOnly: true }
]

function NavItems({ isAdmin, onNavigate }) {
  return (
    <ul className="menu gap-1">
      {LINKS.filter((l) => !l.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth()

  return (
    <>
      {/* Desktop: permanent sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-base-200 border-r border-base-300 p-4">
        <NavItems isAdmin={isAdmin} />
      </aside>

      {/* Mobile: drawer */}
      <div className={`drawer lg:hidden ${open ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
        <aside
          className="fixed z-50 top-0 left-0 h-full w-64 bg-base-200 p-4 shadow-xl"
          role="dialog"
          aria-label="Menu de navigation"
        >
          <div className="flex justify-end mb-2">
            <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose} aria-label="Fermer le menu">
              <X className="w-4 h-4" />
            </button>
          </div>
          <NavItems isAdmin={isAdmin} onNavigate={onClose} />
        </aside>
      </div>
    </>
  )
}
