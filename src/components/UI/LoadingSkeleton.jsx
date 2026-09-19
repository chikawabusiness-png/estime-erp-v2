export default function LoadingSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full space-y-3" role="status" aria-label="Chargement en cours">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton-shimmer h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
