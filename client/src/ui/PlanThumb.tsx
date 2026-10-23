/** A small plot-and-rooms thumbnail from plain rectangles. */
export function PlanThumb({
  width,
  length,
  rooms,
  className = "plan-thumb",
}: {
  width: number;
  length: number;
  rooms: [number, number, number, number, 0 | 1][];
  className?: string;
}) {
  const pad = Math.max(width, length) * 0.04;
  return (
    <svg className={className} viewBox={`${-pad} ${-pad} ${width + pad * 2} ${length + pad * 2}`} aria-hidden>
      <rect x={0} y={0} width={width} height={length} fill="var(--soft)" stroke="var(--muted)" strokeWidth={Math.max(width, length) * 0.006} />
      {rooms.map(([x, y, w, l, open], i) => (
        <rect key={i} x={x} y={y} width={w} height={l} fill={open ? "#dbe6cf" : "#eadfce"} stroke="#5b5348" strokeWidth={Math.max(width, length) * (open ? 0.004 : 0.012)} />
      ))}
    </svg>
  );
}
