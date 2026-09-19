import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabaseClient'
import Button from '../UI/Button'
import { messages, patterns, validatePattern } from '../../lib/validation'
import ProductQrScanner from './ProductQrScanner'

export default function ProductForm({ product, onSuccess }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: product || {
      name: '', sku: '', description: '', price: 0, stock: 0,
      stock_threshold_mode: 'fixed', fixed_min_stock: 0, volume_ml: 20
    }
  })
  const [file, setFile] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const watchedValues = watch(['name', 'sku', 'price'])
  const [watchedName, watchedSku, watchedPrice] = watchedValues

  useEffect(() => {
    reset(product ? {
      ...product,
      properties: product.properties || {}
    } : {
      name: '', sku: '', description: '', price: 0, stock: 0,
      stock_threshold_mode: 'fixed', fixed_min_stock: 0, volume_ml: 20,
      properties: {}
    })
  }, [product, reset])

  useEffect(() => {
    if (!watchedName?.trim() || !watchedSku?.trim() || watchedPrice === '' || Number.isNaN(Number(watchedPrice))) {
      setQrDataUrl('')
      return undefined
    }

    const payload = JSON.stringify({
      schema_version: '1.0',
      type: 'perfume_product',
      sku: watchedSku.trim(),
      name: watchedName.trim(),
      price: Number(watchedPrice),
      currency: 'MAD',
      volume_ml: null,
      date_added: product?.created_at
        ? new Date(product.created_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    }, null, 2)

    let active = true
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 280 })
      .then((url) => {
        if (active) setQrDataUrl(url)
      })
      .catch((error) => {
        if (active) {
          setQrDataUrl('')
          toast.error(`Génération du QR impossible : ${error.message}`)
        }
      })

    return () => {
      active = false
    }
  }, [product?.created_at, watchedName, watchedSku, watchedPrice])

  const downloadQr = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `qr-${watchedSku}.png`
    link.click()
  }

  const onSubmit = async (values) => {
    try {
      let image_path = product?.image_path || null

      if (file) {
        const ext = file.name.split('.').pop()
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, file, { upsert: true })
        if (uploadError) throw uploadError
        image_path = path
      }

      const payload = {
        name: values.name,
        sku: values.sku?.trim() || null,
        description: values.description,
        price: Number(values.price),
        volume_ml: Number(values.volume_ml),
        properties: {
          ...(product?.properties || {}),
          volume_ml: Number(values.volume_ml),
          stock_threshold: values.fixed_min_stock === '' ||
            values.fixed_min_stock === undefined ||
            Number.isNaN(values.fixed_min_stock)
            ? null
            : Number(values.fixed_min_stock)
        },
        stock_threshold_mode: 'fixed',
        fixed_min_stock: values.fixed_min_stock === '' ||
          values.fixed_min_stock === undefined ||
          Number.isNaN(values.fixed_min_stock)
          ? null
          : Number(values.fixed_min_stock),
        image_path
      }

      const { error } = product
        ? await supabase.from('products').update(payload).eq('id', product.id)
        : await supabase.from('products').insert(payload)

      if (error) throw error

      toast.success(product ? 'Produit mis à jour' : 'Produit créé')
      onSuccess?.()
    } catch (err) {
      toast.error(`Erreur : ${err.message}`)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="form-control">
        <label className="label" htmlFor="name">
          <span className="label-text">Nom</span>
        </label>
        <input
          id="name"
          className="input input-bordered"
          {...register('name', {
            required: 'Le nom est requis',
            validate: (value) => validatePattern(value, patterns.text, messages.text)
          })}
          aria-invalid={!!errors.name}
        />
        {errors.name && <span className="text-error text-sm">{errors.name.message}</span>}
      </div>

      <div className="rounded-box border border-base-300 bg-base-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">Code QR du produit</p>
            <p className="text-xs opacity-70">Génération automatique après saisie du nom, SKU et prix.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
            Scanner un QR
          </Button>
        </div>
        {qrDataUrl && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <img src={qrDataUrl} alt="Aperçu du code QR du produit" className="h-52 w-52 rounded bg-white p-2" />
            <Button type="button" variant="ghost" onClick={downloadQr}>
              Télécharger le QR
            </Button>
          </div>
        )}
      </div>

      <div className="form-control">
        <label className="label" htmlFor="sku">
          <span className="label-text">SKU <span className="opacity-60">(automatique si vide)</span></span>
        </label>
        <input
          id="sku"
          className="input input-bordered"
          {...register('sku', {
            pattern: { value: /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/, message: 'SKU invalide.' }
          })}
          aria-invalid={!!errors.sku}
        />
        {errors.sku && <span className="text-error text-sm">{errors.sku.message}</span>}
      </div>

      <div className="form-control">
        <label className="label" htmlFor="description">
          <span className="label-text">Description</span>
        </label>
        <textarea id="description" className="textarea textarea-bordered" {...register('description')} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="form-control">
          <label className="label" htmlFor="price">
            <span className="label-text">Prix (DH)</span>
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            className="input input-bordered"
            {...register('price', {
              required: 'Le prix est requis',
              min: { value: 0, message: 'Le prix doit être positif.' },
              valueAsNumber: true
            })}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="volume_ml">
            <span className="label-text">Volume (ml)</span>
          </label>
          <input
            id="volume_ml"
            type="number"
            min="1"
            className="input input-bordered"
            {...register('volume_ml', {
              required: 'Le volume est requis',
              min: { value: 1, message: 'Le volume doit être supérieur à zéro.' },
              valueAsNumber: true
            })}
          />
          {errors.volume_ml && <span className="text-error text-sm">{errors.volume_ml.message}</span>}
        </div>

        <div className="rounded-box border border-base-300 bg-base-200 p-4">
          <p className="font-semibold">Stock minimal</p>
          <p className="mb-3 text-xs opacity-70">
            Définissez la quantité minimale qui déclenche l’alerte de réapprovisionnement.
          </p>
          <label className="form-control">
            <span className="label-text">Minimum fixe <span className="opacity-60">(facultatif)</span></span>
            <input type="number" min="0" className="input input-bordered"
              {...register('fixed_min_stock', { min: 0, valueAsNumber: true })} />
          </label>
        </div>
        <div className="form-control">
          <label className="label" htmlFor="stock">
            <span className="label-text">Stock disponible</span>
          </label>
          <input
            id="stock"
            type="number"
            className="input input-bordered"
            value={product?.stock ?? 0}
            readOnly
            aria-describedby="stock-help"
          />
          <span id="stock-help" className="mt-1 text-xs opacity-60">
            Le stock est géré automatiquement par les achats, la production et les commandes.
          </span>
        </div>
      </div>

      <div className="form-control">
        <label className="label" htmlFor="image">
          <span className="label-text">Image du produit</span>
        </label>
        <input
          id="image"
          type="file"
          accept="image/*"
          className="file-input file-input-bordered"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          aria-label="Téléverser une image du produit"
        />
      </div>

      <div className="modal-action">
        <Button type="submit" loading={isSubmitting}>
          {product ? 'Enregistrer' : 'Créer'}
        </Button>
      </div>
      <ProductQrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(product) => {
          setValue('name', product.name, { shouldValidate: true, shouldDirty: true })
          setValue('sku', product.sku, { shouldValidate: true, shouldDirty: true })
          setValue('price', product.price, { shouldValidate: true, shouldDirty: true })
          setScannerOpen(false)
          toast.success('Produit rempli depuis le QR')
        }}
      />
    </form>
  )
}
