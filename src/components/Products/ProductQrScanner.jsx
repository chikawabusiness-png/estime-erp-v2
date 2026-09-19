import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import toast from 'react-hot-toast'

export default function ProductQrScanner({ open, onClose, onScan }) {
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState('')
  onScanRef.current = onScan

  useEffect(() => {
    if (!open) return undefined

    const scanner = new Html5Qrcode('product-qr-reader')
    scannerRef.current = scanner
    let stopped = false

    const stop = async () => {
      if (stopped) return
      stopped = true
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
      scannerRef.current = null
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          try {
            let product
            try {
              product = JSON.parse(decodedText)
            } catch {
              product = { sku: decodedText.trim() }
            }
            if (!product || typeof product !== 'object' || (!product.sku && !product.id && !product.product_code)) {
              throw new Error('Ce QR ne contient pas une référence produit valide.')
            }
            await stop()
            onScanRef.current(product)
          } catch (scanError) {
            setError(scanError.message || 'QR invalide.')
          }
        },
        () => {}
      )
      .catch((cameraError) => {
        setError(`Caméra inaccessible : ${cameraError.message || cameraError}`)
      })

    return () => {
      stop().catch((stopError) => {
        toast.error(`Arrêt du scanner impossible : ${stopError.message}`)
      })
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-box bg-base-100 p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Scanner un QR produit</h2>
          <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label="Fermer le scanner">
            ×
          </button>
        </div>
        <p className="mb-3 text-sm opacity-70">
          Autorisez la caméra et placez le QR dans le cadre. Le SKU ou l’identifiant sera recherché dans le catalogue.
        </p>
        <div id="product-qr-reader" className="w-full overflow-hidden rounded-box border border-base-300" />
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <div className="modal-action">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
