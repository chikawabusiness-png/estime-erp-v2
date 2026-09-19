import { useEffect, useState } from 'react'

const STORAGE_KEY = 'estime-erp-branding'
const DEFAULT_BRANDING = {
  logo: '/estime-logo.png',
  text: 'Estime Parfum ERP',
  showTextInHeader: true
}

function readBranding() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      ...DEFAULT_BRANDING,
      ...saved,
      showTextInHeader: saved.showTextInHeader ?? saved.showTextInSidebar ?? DEFAULT_BRANDING.showTextInHeader
    }
  } catch {
    return DEFAULT_BRANDING
  }
}

export function useBranding() {
  const [branding, setBranding] = useState(readBranding)

  useEffect(() => {
    const sync = () => setBranding(readBranding())
    window.addEventListener('storage', sync)
    window.addEventListener('branding-changed', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('branding-changed', sync)
    }
  }, [])

  const updateBranding = (changes) => {
    const next = { ...branding, ...changes }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setBranding(next)
    window.dispatchEvent(new Event('branding-changed'))
  }

  const resetBranding = () => {
    localStorage.removeItem(STORAGE_KEY)
    setBranding(DEFAULT_BRANDING)
    window.dispatchEvent(new Event('branding-changed'))
  }

  return { branding, updateBranding, resetBranding }
}

export { DEFAULT_BRANDING }
