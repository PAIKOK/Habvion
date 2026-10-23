/** Grey placeholder shapes shown while content loads. Hidden from screen readers; the container says it is busy. */
export function Skeleton({ width = "100%", height = 14, radius = 6, className = "" }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/** A page-shaped placeholder: heading, a few lines, and optional cards. */
export function PageSkeleton({ cards = 0, label = "Loading" }: { cards?: number; label?: string }) {
  return (
    <div className="page-skeleton" role="status" aria-busy="true" aria-label={label}>
      <Skeleton width={110} height={10} />
      <Skeleton width="min(420px, 80%)" height={40} radius={8} />
      <Skeleton width="min(560px, 95%)" />
      <Skeleton width="min(480px, 85%)" />
      {cards > 0 && (
        <div className="skeleton-cards">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="skeleton-card">
              <Skeleton height={150} radius={8} />
              <Skeleton width="70%" height={16} />
              <Skeleton width="45%" height={12} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
