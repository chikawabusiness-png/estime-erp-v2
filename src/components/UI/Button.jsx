import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  error: 'btn-error',
  success: 'btn-success'
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  type = 'button',
  ariaLabel,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`btn ${VARIANTS[variant] ?? VARIANTS.primary} ${className}`}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
