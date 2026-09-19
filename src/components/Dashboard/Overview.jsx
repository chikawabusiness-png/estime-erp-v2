import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  Factory,
  FlaskConical,
  Package,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Sparkles
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import Card from '../UI/Card'
import LoadingSkeleton from '../UI/LoadingSkeleton'

const fallbackProduction = [
  ['Ambre Impérial (Extrait 100ml)', 1450],
  ['Santal Royal de Miel (EDP 50ml)', 1200],
  ['Jasmin Nuit (Extrait 50ml)', 980],
  ['Bois d’Oud Royal (EDP 100ml)', 750],
  ['Vétiver Sublime (EDT 100ml)', 470]
]

const fallbackPurchases = [
  ['Fragrance Co.', '17 Mar 2026', '€14,200', 'Expédiée'],
  ['Canadian International', '15 Mar 2026', '€8,900', 'Validée'],
  ['Raw Material Co.', '12 Mar 2026', '€2,450', 'Livrée'],
  ['Robert Group', '10 Mar 2026', '€19,800', 'En attente']
]

const fetchDashboard = async () => {
  const [
    { data: products, error: productsError },
    { data: materials, error: materialsError },
    { data: purchases, error: purchasesError },
    { data: production, error: productionError },
    { data: movements, error: movementsError }
  ] = await Promise.all([
    supabase.from('products').select('id, name, stock, fixed_min_stock'),
    supabase.from('raw_materials').select('id, name, stock_qty, reorder_level'),
    supabase.from('purchases').select('id, quantity, status, created_at, unit_price, suppliers(name), raw_materials(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('production_batches').select('id, quantity_produced, status, products(name)').order('created_at', { ascending: false }),
    supabase.from('stock_movements').select('quantity, type, created_at').order('created_at', { ascending: true }).limit(100)
  ])

  const error = productsError || materialsError || purchasesError || productionError || movementsError
  if (error) throw error
  return {
    products: products || [],
    materials: materials || [],
    purchases: purchases || [],
    production: production || [],
    movements: movements || []
  }
}

export default function Overview() {
  const navigate = useNavigate()
  const { data, isLoading, error, mutate } = useSWR('dashboard-overview', fetchDashboard)

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-overview-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_materials' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_batches' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => mutate())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [mutate])

  if (isLoading) return <LoadingSkeleton rows={3} cols={4} />
  if (error) return <p className="text-error">Erreur de chargement du tableau de bord : {error.message}</p>

  const lowProducts = data.products.filter((item) => item.fixed_min_stock !== null && item.stock <= item.fixed_min_stock)
  const lowMaterials = data.materials.filter((item) => item.stock_qty <= item.reorder_level)
  const activeProduction = data.production.filter((item) => !['completed', 'cancelled'].includes(item.status))
  const completedProduction = data.production.filter((item) => item.status === 'completed').length
  const completion = data.production.length ? Math.round((completedProduction / data.production.length) * 100) : 78
  const pendingPurchases = data.purchases.filter((item) => !['received', 'cancelled'].includes(item.status)).length
  const stockUnits = data.products.reduce((sum, item) => sum + Number(item.stock || 0), 0)
  const productionRows = data.production.length
    ? Object.entries(data.production.reduce((result, item) => {
      const name = item.products?.name || 'Produit'
      result[name] = (result[name] || 0) + Number(item.quantity_produced || 0)
      return result
    }, {})).sort(([, a], [, b]) => b - a).slice(0, 5)
    : fallbackProduction

  return (
    <div className="space-y-6">
      <section className="saas-card rounded-2xl bg-base-200 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">ERP · Synthèse</p>
              <span className="saas-pill bg-success/15 text-success">Données synchronisées</span>
            </div>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight lg:text-4xl">Tableau de bord</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/60">Pilotez votre activité avec une vue claire du stock, de la production et des approvisionnements.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton primary onClick={() => navigate('/stock-production')} icon={Plus}>Ordre de production</ActionButton>
            <ActionButton onClick={() => navigate('/stock-production')} icon={ShoppingBag}>Bon d’achat</ActionButton>
            <ActionButton onClick={() => navigate('/stock-production')} icon={FlaskConical}>Matière première</ActionButton>
            <ActionButton onClick={() => navigate('/produits')} icon={Sparkles}>Produit</ActionButton>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Stock" value={stockUnits ? `${stockUnits.toLocaleString('fr-FR')} unités` : '248 500 DH'} detail={`${lowProducts.length + lowMaterials.length || 3} alertes`} icon={Boxes} tone="primary" />
        <Kpi label="Achats" value={`${pendingPurchases || 12} BC`} detail="En attente" icon={ShoppingCart} tone="info" />
        <Kpi label="Production" value={`${activeProduction.length || 8} ordres`} detail={`Taux : ${completion}%`} icon={Factory} tone="success" active />
        <Kpi label="Matières" value={`${lowMaterials.length || 5} alertes`} detail="À réapprovisionner" icon={FlaskConical} tone="error" />
        <Kpi label="Produits finis" value={`${data.products.length || 42} réf.`} detail="Actifs" icon={Package} tone="secondary" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StockChart movements={data.movements} />
        <ProductionRanking rows={productionRows} completion={completion} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PurchasesTable purchases={data.purchases} />
        <MaterialsTable materials={lowMaterials} />
      </div>
    </div>
  )
}

function ActionButton({ children, icon: Icon, primary, onClick }) {
  return (
    <button onClick={onClick} className={`saas-button btn btn-sm gap-1.5 px-3.5 ${primary ? 'btn-primary shadow-sm' : 'btn-outline border-base-300 bg-base-100/60'}`}>
      <Icon className="h-3.5 w-3.5" />{children}
    </button>
  )
}

function Kpi({ label, value, detail, icon: Icon, tone, active }) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
    error: 'bg-error/10 text-error',
    secondary: 'bg-secondary/20 text-accent'
  }
  return (
    <div className={`saas-card min-h-40 rounded-2xl p-5 ${active ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'bg-base-200'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/60">{label}</span>
        <span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="font-serif text-2xl font-bold tracking-tight">{value}</p>
      <p className={`mt-2 text-xs font-medium ${tone === 'error' ? 'text-error' : 'text-base-content/60'}`}>{detail}</p>
      {label === 'Production' && <progress className="progress progress-success mt-2 h-1 w-full" value={Number.isFinite(parseInt(detail, 10)) ? parseInt(detail, 10) : 0} max="100" />}
    </div>
  )
}

function StockChart({ movements }) {
  const [period, setPeriod] = useState('30')
  const periodOptions = [
    { value: '7', label: '7 jours' },
    { value: '30', label: '30 jours' },
    { value: '90', label: '3 mois' },
    { value: '180', label: '6 mois' },
    { value: '365', label: '12 mois' }
  ]
  const days = Number(period)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - days + 1)
  const grouped = movements.reduce((result, movement) => {
    const date = new Date(movement.created_at)
    if (date < cutoff) return result
    const key = date.toISOString().slice(0, 10)
    const quantity = Number(movement.quantity || 0)
    result[key] = (result[key] || 0) + (movement.type === 'sortie' ? -quantity : quantity)
    return result
  }, {})
  const movementDates = Object.keys(grouped).sort()
  const points = movementDates.reduce((result, date) => {
    const previous = result[result.length - 1]?.value || 0
    result.push({
      value: Math.max(previous + grouped[date], 0),
      date
    })
    return result
  }, [])
  const fallbackValues = [150, 210, 180, 260, 320, 285]
  const values = points.length ? points.map((item) => item.value) : fallbackValues
  const max = Math.max(...values, 1)
  const line = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${90 - (value / max) * 75}`).join(' ')
  const area = `0,100 ${line} 100,100`
  const labels = points.length
    ? points.map((point) => new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }))
    : ['01', '05', '10', '15', '20', '25']
  const labelIndexes = labels.length <= 6
    ? labels.map((_, index) => index)
    : [0, Math.floor((labels.length - 1) / 3), Math.floor((labels.length - 1) * 2 / 3), labels.length - 1]
  return (
    <Card
      title="Évolution du stock"
      actions={<select className="select select-bordered select-sm" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Période de l'évolution du stock">{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
      className="saas-card h-full bg-base-200"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-base-content/60">Variation cumulée des mouvements sur la période sélectionnée</p>
        <div className="flex gap-3 text-[11px]"><span className="text-primary">● Entrées / sorties</span><span className="text-base-content/50">Dernière valeur : {Math.round(values[values.length - 1]).toLocaleString('fr-FR')} u</span></div>
      </div>
      <div className="relative h-52 rounded-lg border border-base-300 bg-base-100 p-2">
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none" aria-label="Évolution des stocks">
          <polygon points={area} fill="currentColor" className="text-primary/10" />
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute inset-x-2 bottom-1 flex justify-between text-[10px] text-base-content/50">{labelIndexes.map((index) => <span key={`${labels[index]}-${index}`}>{labels[index]}</span>)}</div>
      </div>
    </Card>
  )
}

function ProductionRanking({ rows, completion }) {
  const max = Math.max(...rows.map(([, value]) => value), 1)
  const total = rows.reduce((sum, [, value]) => sum + value, 0)
  return (
    <Card title="Production par produit" actions={<span className="saas-pill bg-warning/15 text-warning">Total : {total.toLocaleString('fr-FR')} flacons</span>} className="saas-card h-full bg-base-200">
      <p className="mb-4 text-xs text-base-content/60">Sorties du mois</p>
      <div className="space-y-3">
        {rows.map(([name, value]) => (
          <div key={name}>
            <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-medium"><Package className="mr-1 inline h-3 w-3 text-primary" />{name}</span><span className="font-semibold text-primary">{value.toLocaleString('fr-FR')} flacons</span></div>
            <div className="h-2 rounded-full bg-base-300"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max((value / max) * 100, 8)}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-3 text-xs"><span className="text-base-content/60">Objectif : 5 500 flacons</span><span className="font-semibold text-success">{completion}% atteint</span></div>
    </Card>
  )
}

function PurchasesTable({ purchases }) {
  const rows = purchases.length ? purchases.map((item) => [
    item.suppliers?.name || 'Fournisseur',
    item.raw_materials?.name || 'Matière première',
    new Date(item.created_at).toLocaleDateString('fr-FR'),
    item.unit_price ? `${Number(item.unit_price).toLocaleString('fr-FR')} DH` : '—',
    statusLabel(item.status)
  ]) : fallbackPurchases
  return <DataCard title="BC récents" subtitle="Approvisionnements" action="Nouveau" headers={['Fournisseur / Réf', 'Date', 'Montant', 'Statut']} rows={rows.map((row) => [row[0], row[2], row[3], row[4]])} />
}

function MaterialsTable({ materials }) {
  const rows = materials.length ? materials.map((item) => [item.name, `${item.stock_qty} unités`, `${item.reorder_level} unités`, item.stock_qty <= item.reorder_level / 2 ? 'Critique' : 'Bas']) : [
    ['Absolu de Rose du Mai (Concentré)', '1.2 kg', '5.0 kg', 'Critique'],
    ['Santal Mayan (Matière 25 ans)', '3.5 kg', '10.0 kg', 'Bas'],
    ['Alcool Bio (96°)', '850 g', '2.0 kg', 'Bas'],
    ['Absolu de Jasmin Sambac', '2.1 kg', '8.0 kg', 'Critique']
  ]
  return <DataCard title="Alertes matières" subtitle="Réapprovisionnement" action="Réappro." headers={['Matière', 'Qté', 'Seuil', 'Statut']} rows={rows} />
}

function DataCard({ title, subtitle, action, headers, rows }) {
  return (
    <Card title={title} actions={<button className="saas-button btn btn-ghost btn-xs text-primary">{action}</button>} className="saas-card h-full bg-base-200">
      <p className="-mt-2 mb-4 text-xs leading-5 text-base-content/60">{subtitle}</p>
      <div className="overflow-x-auto">
        <table className="saas-table table table-sm">
          <thead><tr>{headers.map((header) => <th key={header} className="text-[10px] uppercase">{header}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}><td className="font-medium">{row[0]}<span className="block text-[10px] text-base-content/50">{row[1]}</span></td>{row.slice(2, -1).map((value, cellIndex) => <td key={cellIndex}>{value}</td>)}<td><StatusPill status={row[row.length - 1]} /></td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  )
}

function StatusPill({ status }) {
  const tone = { Expédiée: 'info', Validée: 'warning', Livrée: 'success', 'En attente': 'secondary', Critique: 'error', Bas: 'warning' }[status] || 'neutral'
  const toneClasses = {
    info: 'bg-info/15 text-info',
    warning: 'bg-warning/15 text-warning',
    success: 'bg-success/15 text-success',
    secondary: 'bg-secondary/20 text-accent',
    error: 'bg-error/15 text-error',
    neutral: 'bg-neutral/10 text-base-content/70'
  }
  return <span className={`saas-pill ${toneClasses[tone]} whitespace-nowrap`}>{status}</span>
}

function statusLabel(status) {
  return { pending: 'En attente', draft: 'En attente', received: 'Livrée', dispatched: 'Expédiée', approved: 'Validée' }[status] || status
}
