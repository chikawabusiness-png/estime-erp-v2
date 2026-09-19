function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function Avatar({ src, name, size = 10 }) {
  const dimension = `w-${size} h-${size}`
  if (src) {
    return (
      <div className={`avatar`}>
        <div className={`${dimension} rounded-full`}>
          <img src={src} alt={`Avatar de ${name || 'utilisateur'}`} />
        </div>
      </div>
    )
  }
  return (
    <div className="avatar placeholder" aria-label={`Avatar de ${name || 'utilisateur'}`}>
      <div className={`bg-primary text-primary-content rounded-full ${dimension} flex items-center justify-center`}>
        <span className="text-sm font-semibold">{initials(name) || '?'}</span>
      </div>
    </div>
  )
}
