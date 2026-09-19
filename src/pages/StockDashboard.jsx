import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Html5Qrcode } from 'html5-qrcode'
import { AlertTriangle, Boxes, Package, QrCode, RefreshCw, ScanLine, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import Card from '../components/UI/Card'
import LoadingSkeleton from '../components/UI/LoadingSkeleton'
import Modal from '../components/UI/Modal'

const fetchStockDashboard = async () => {
  const [{ data: products, error: productsError }, { data: materials, error: materialsError }] = await Promise.all([
    supabase.from('products').select('id, sku, name, stock, fixed_min_stock').order('stock'),
    supabase.from('raw_materials').select('id, name, unit, stock_qty, reorder_level').order('stock_qty')
  ])
  if (productsError) throw productsError
  if (materialsError) throw materialsError
  return { products: products || [], materials: materials || [] }
}

export default function StockDashboard() {
  const { data, error, isLoading, mutate } = useSWR('stock-dashboard', fetchStockDashboard)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedItem, setScannedItem] = useState(null)

  if (isLoading) return <LoadingSkeleton rows={3} cols={4} />
  if (error) return <p className="text-error">Erreur de chargement du tableau de bord stock : {error.message}</p>

  const products = data.products
  const materials = data.materials
  const lowProducts = products.filter((item) => item.fixed_min_stock !== null && item.stock <= item.fixed_min_stock)
  const lowMaterials = materials.filter((item) => item.stock_qty <= item.reorder_level)
  const totalProductUnits = products.reduce((sum, item) => sum + Number(item.stock || 0), 0)
  const alerts = [...lowProducts.map((item) => ({ ...item, kind: 'Produit', quantity: item.stock, threshold: item.fixed_min_stock })), ...lowMaterials.map((item) => ({ ...item, kind: 'Matière', quantity: item.stock_qty, threshold: item.reorder_level }))]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Tableau de bord du stock</h2>
          <p className="text-sm text-base-content/60">Vue globale des produits et matières premières.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => setScannerOpen(true)}>
            <QrCode className="h-4 w-4" /> Scanner QR
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => mutate()} aria-label="Actualiser le stock">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Produits" value={products.length} icon={Package} tone="primary" />
        <Kpi label="Matières premières" value={materials.length} icon={Boxes} tone="secondary" />
        <Kpi label="Unités produits" value={totalProductUnits} icon={TrendingUp} tone="success" />
        <Kpi label="Alertes stock" value={alerts.length} icon={AlertTriangle} tone={alerts.length ? 'warning' : 'success'} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Niveaux des produits">
          <StockTable rows={products.map((item) => ({
            id: item.id,
            code: item.sku || '—',
            name: item.name,
            quantity: item.stock,
            threshold: item.fixed_min_stock,
            unit: 'unités'
          }))} emptyLabel="Aucun produit" />
        </Card>
        <Card title="Niveaux des matières premières">
          <StockTable rows={materials.map((item) => ({
            id: item.id,
            code: 'MAT',
            name: item.name,
            quantity: item.stock_qty,
            threshold: item.reorder_level,
            unit: item.unit
          }))} emptyLabel="Aucune matière première" />
        </Card>
      </div>

      <Card title="Alertes de réapprovisionnement">
        {alerts.length === 0 ? (
          <p className="text-sm text-success">Aucune alerte : les niveaux de stock sont suffisants.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />{item.kind} : {item.name}</span>
                <span className="font-semibold">{item.quantity} / {item.threshold}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <StockQrScanner
        open={scannerOpen}
        products={products}
        materials={materials}
        onClose={() => setScannerOpen(false)}
        onMatch={(item) => {
          setScannedItem(item)
          setScannerOpen(false)
        }}
      />
      <Modal open={!!scannedItem} onClose={() => setScannedItem(null)} title="Article identifié">
        {scannedItem && (
          <div className="space-y-3">
            <div className="rounded-lg bg-base-200 p-4">
              <p className="text-xs uppercase tracking-wide text-base-content/60">{scannedItem.type}</p>
              <p className="text-lg font-semibold">{scannedItem.item.name}</p>
              <p className="mt-1 text-sm">Stock : <strong>{scannedItem.item.stockValue}</strong> {scannedItem.item.unit || 'unités'}</p>
              {scannedItem.item.sku && <p className="font-mono text-xs text-base-content/60">SKU : {scannedItem.item.sku}</p>}
            </div>
            <button type="button" className="btn btn-outline w-full" onClick={() => setScannedItem(null)}>Fermer</button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function StockQrScanner({ open, products, materials, onClose, onMatch }) {
  const scannerId = useRef(`stock-qr-reader-${Math.random().toString(36).slice(2)}`).current
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    setError('')
    const scanner = new Html5Qrcode(scannerId)
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        let payload = {}
        try {
          payload = JSON.parse(decodedText)
        } catch {
          payload = { sku: decodedText.trim() }
        }
        const code = String(payload.sku || payload.product_code || payload.id || '').toLowerCase()
        const product = products.find((item) => item.id === payload.id || item.sku?.toLowerCase() === code)
        if (product) {
          onMatch({ type: 'Produit', item: { ...product, stockValue: product.stock } })
          return
        }
        const material = materials.find((item) => item.id === payload.id || item.name.toLowerCase() === code)
        if (material) {
          onMatch({ type: 'Matière première', item: { ...material, stockValue: material.stock_qty } })
          return
        }
        setError('Article introuvable dans l’inventaire.')
      },
      () => {}
    ).catch((scannerError) => setError(`Caméra indisponible : ${scannerError.message}`))

    return () => {
      scanner.stop().catch(() => {})
      scanner.clear()
    }
  }, [open, products, materials, onMatch, scannerId])

  return (
    <Modal open={open} onClose={onClose} title="Scanner un article">
      <div id={scannerId} className="min-h-56 overflow-hidden rounded-lg bg-black" />
      <p className="mt-3 flex items-center gap-2 text-sm text-base-content/60"><ScanLine className="h-4 w-4" /> Scannez le QR d’un produit ou d’une matière.</p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      <button type="button" className="btn btn-ghost mt-3 w-full" onClick={onClose}>Fermer</button>
    </Modal>
  )
}

function Kpi({ label, value, icon: Icon, tone }) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning'
  }

  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-3 ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-sm text-base-content/60">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function StockTable({ rows, emptyLabel }) {
  if (!rows.length) return <p className="text-sm text-base-content/60">{emptyLabel}</p>
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead><tr><th>Référence</th><th>Article</th><th>Stock</th><th>Seuil</th></tr></thead>
        <tbody>
          {rows.slice(0, 8).map((row) => {
            const isLow = row.threshold !== null && row.quantity <= row.threshold
            return (
              <tr key={row.id}>
                <td className="font-mono text-xs">{row.code}</td>
                <td>{row.name}</td>
                <td className={isLow ? 'font-semibold text-error' : ''}>{row.quantity} {row.unit}</td>
                <td>{row.threshold ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
