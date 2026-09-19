export default function Card({ title, actions, children, className = '' }) {
  return (
    <div className={`card w-full bg-base-200 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col items-stretch gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pt-5">
          {title && <h2 className="card-title text-base">{title}</h2>}
          {actions && <div className="action-row sm:justify-end">{actions}</div>}
        </div>
      )}
      <div className="card-body p-4 pt-3 sm:p-5 sm:pt-3">{children}</div>
    </div>
  )
}
