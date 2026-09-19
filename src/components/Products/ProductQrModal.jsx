import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Button from '../UI/Button'
import Modal from '../UI/Modal'

function getPayload(product) {
  return JSON.stringify({
    schema_version: '1.0',
    type: 'perfume_product',
    sku: product.sku,
    name: product.name,
    price: Number(product.price),
    currency: 'MAD',
    volume_ml: product.volume_ml ?? null,
    date_added: product.created_at
      ? new Date(product.created_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  }, null, 2)
}

function getDateAdded(product) {
  return product.created_at
    ? new Date(product.created_at).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')
}

export default function ProductQrModal({ product, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState(null)
  const payload = product ? getPayload(product) : ''

  useEffect(() => {
    let active = true
    if (!product) return undefined

    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320
    })
      .then((url) => {
        if (active) setQrDataUrl(url)
      })
      .catch((generationError) => {
        if (active) setError(generationError)
      })

    return () => {
      active = false
    }
  }, [payload, product])

  if (!product) return null

  const download = () => {
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `qr-${product.sku}.png`
    link.click()
  }

  return (
    <Modal open={Boolean(product)} onClose={onClose} title="Code QR du produit">
      <p className="mb-4 text-sm opacity-70">{product.name} · {product.sku}</p>
        <div className="mt-5 flex min-h-80 items-center justify-center rounded-box border border-base-300 bg-white p-4">
          {error && <p className="text-error">Génération du QR impossible : {error.message}</p>}
          {!error && !qrDataUrl && <span className="loading loading-spinner loading-lg" aria-label="Génération du code QR" />}
          {qrDataUrl && <img src={qrDataUrl} alt={`Code QR de ${product.name}`} className="h-72 w-72" />}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-box bg-base-200 p-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60">Produit</p>
            <p className="font-semibold">{product.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60">SKU</p>
            <p className="font-mono font-semibold">{product.sku}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60">Prix</p>
            <p className="font-semibold">{Number(product.price).toFixed(2)} DH</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60">Volume</p>
            <p className="font-semibold">
              {product.volume_ml ? `${product.volume_ml} ml` : 'Non renseigné'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs uppercase tracking-wide opacity-60">Date d’ajout</p>
            <p className="font-semibold">{getDateAdded(product)}</p>
          </div>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs opacity-60">Afficher les données techniques</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-base-200 p-3 font-mono text-xs opacity-70">{payload}</pre>
        </details>
        <div className="modal-action flex-wrap">
          <Button type="button" onClick={download} disabled={!qrDataUrl}>
            Télécharger PNG
          </Button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Fermer / Retour aux produits
          </button>
        </div>
    </Modal>
  )
}
