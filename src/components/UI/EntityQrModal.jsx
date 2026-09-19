import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Button from './Button'
import Modal from './Modal'

export default function EntityQrModal({ entity, type, title, fields, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState(null)
  const payload = entity
    ? JSON.stringify({
        schema_version: '1.0',
        type,
        id: entity.id,
        ...fields.reduce((data, field) => ({ ...data, [field]: entity[field] ?? null }), {})
      }, null, 2)
    : ''

  useEffect(() => {
    let active = true
    setQrDataUrl('')
    setError(null)
    if (!entity) return undefined

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
  }, [entity, payload])

  if (!entity) return null

  const download = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `qr-${type}-${entity.id}.png`
    link.click()
  }

  return (
    <Modal open={Boolean(entity)} onClose={onClose} title={title}>
      <div className="flex justify-center rounded-box border border-base-300 bg-white p-4">
        {error && <p className="text-error">Génération du QR impossible : {error.message}</p>}
        {!error && !qrDataUrl && <span className="loading loading-spinner loading-lg" aria-label="Génération du code QR" />}
        {qrDataUrl && <img src={qrDataUrl} alt={`Code QR ${title}`} className="h-64 w-64" />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-box bg-base-200 p-4 text-sm">
        {fields.map((field) => (
          <div key={field}>
            <p className="text-xs uppercase tracking-wide opacity-60">{field}</p>
            <p className="font-semibold">{entity[field] ?? '—'}</p>
          </div>
        ))}
      </div>
      <div className="modal-action">
        <Button type="button" onClick={download} disabled={!qrDataUrl}>Télécharger PNG</Button>
        <button type="button" className="btn btn-outline" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  )
}
