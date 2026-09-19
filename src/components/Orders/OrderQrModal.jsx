import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Button from '../UI/Button'
import Modal from '../UI/Modal'

function getPayload(order) {
  return JSON.stringify({
    schema_version: '1.0',
    type: 'perfume_order',
    order_number: order.order_number,
    status: order.status,
    priority: order.priority || 'normale',
    priority_details: order.properties?.priority || null,
    customer: order.customer_name,
    total_mad: Number(order.total.toFixed(2)),
    created_at: order.created_at
  }, null, 2)
}

export default function OrderQrModal({ order, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState(null)
  const payload = order ? getPayload(order) : ''

  useEffect(() => {
    let active = true
    setQrDataUrl('')
    setError(null)
    if (!order) return undefined

    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
      .then((url) => {
        if (active) setQrDataUrl(url)
      })
      .catch((generationError) => {
        if (active) setError(generationError)
      })

    return () => {
      active = false
    }
  }, [order, payload])

  if (!order) return null

  const download = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `qr-${order.order_number}.png`
    link.click()
  }

  return (
    <Modal open={Boolean(order)} onClose={onClose} title={`Code QR — ${order.order_number}`}>
      <p className="mb-4 text-sm opacity-70">QR de suivi de la commande</p>
      <div className="flex min-h-80 items-center justify-center rounded-box border border-base-300 bg-white p-4">
        {error && <p className="text-error">Génération du QR impossible : {error.message}</p>}
        {!error && !qrDataUrl && <span className="loading loading-spinner loading-lg" aria-label="Génération du code QR" />}
        {qrDataUrl && <img src={qrDataUrl} alt={`Code QR de ${order.order_number}`} className="h-72 w-72" />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-box bg-base-200 p-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">N° commande</p>
          <p className="font-mono font-semibold">{order.order_number}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">Statut</p>
          <p className="font-semibold">{order.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">Client</p>
          <p className="font-semibold">{order.customer_name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">Total</p>
          <p className="font-semibold">{order.total.toFixed(2)} DH</p>
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs opacity-60">Afficher les données techniques</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-base-200 p-3 font-mono text-xs opacity-70">{payload}</pre>
      </details>
      <div className="modal-action flex-wrap">
        <Button type="button" onClick={download} disabled={!qrDataUrl}>Télécharger PNG</Button>
        <button type="button" className="btn btn-outline" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  )
}
