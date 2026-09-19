import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onClose}
      onCancel={onClose}
      aria-label={title}
    >
      <div className="modal-box w-[calc(100%-1rem)] max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose} aria-label="Fermer">close</button>
      </form>
    </dialog>
  )
}
