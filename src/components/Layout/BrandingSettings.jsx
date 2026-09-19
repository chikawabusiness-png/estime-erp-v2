import { useRef, useState } from 'react'
import { ImagePlus, RotateCcw, Upload } from 'lucide-react'
import Modal from '../UI/Modal'
import Button from '../UI/Button'
import { useBranding } from '../../hooks/useBranding'

export default function BrandingSettings({ open, onClose }) {
  const { branding, updateBranding, resetBranding } = useBranding()
  const fileInputRef = useRef(null)
  const [text, setText] = useState(branding.text)

  const saveText = () => {
    updateBranding({ text: text.trim() || 'Estime Parfum ERP' })
  }

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = () => updateBranding({ logo: reader.result })
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <Modal open={open} onClose={onClose} title="Personnaliser la marque">
      <div className="space-y-4">
        <div className="rounded-lg border border-base-300 p-3">
          <p className="mb-2 text-sm font-semibold">Logo</p>
          <div className="flex items-center gap-3">
            <img src={branding.logo} alt="Logo actuel" className="h-16 w-24 object-contain" />
            <div>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Changer le logo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <p className="mt-1 text-xs text-base-content/60">Image JPG, PNG ou SVG, 2 Mo maximum.</p>
            </div>
          </div>
        </div>

        <label className="form-control">
          <span className="label-text mb-1 text-sm font-semibold">Texte de la marque</span>
          <input
            className="input input-bordered"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={saveText}
            aria-label="Texte de la marque"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300 p-3">
          <span>
            <span className="block text-sm font-semibold">Afficher le texte à côté du logo</span>
            <span className="text-xs text-base-content/60">Masquez-le pour afficher uniquement le logo en haut.</span>
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={branding.showTextInHeader}
            onChange={(event) => updateBranding({ showTextInHeader: event.target.checked })}
          />
        </label>

        <div className="flex justify-between border-t border-base-300 pt-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetBranding}>
            <RotateCcw className="h-4 w-4" /> Réinitialiser
          </button>
          <Button type="button" onClick={onClose}>
            <ImagePlus className="h-4 w-4" /> Terminer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
