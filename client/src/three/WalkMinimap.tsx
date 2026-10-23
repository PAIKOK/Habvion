import { memo, useId, useMemo, useState } from "react";
import type { HomeDesign, Room } from "@shared/types/home";
import type { WalkLocation } from "@shared/design/walkLocation";
import { itemFor } from "@shared/design/catalog";
import { footprint, layerOf } from "@shared/design/furniture";
import { openingLine } from "@shared/design/walls";
import { isOpenAir } from "@shared/design/roomTypes";
import { floorLabel } from "@shared/lib/units";

function shortName(room: Room) {
  return room.name.replace(/master bedroom/i, "Master").replace(/guest bedroom/i, "Guest")
    .replace(/bedroom/gi, "Bed").replace(/ room/gi, "").replace(/Entrance porch/i, "Porch");
}

// The floor plan only redraws when the floor or highlighted room changes, not on every step.
const MapPlan = memo(function MapPlan({ design, floor, roomId }: { design: HomeDesign; floor: number; roomId: string | null }) {
  const rooms = design.rooms.filter(r => r.floor === floor),
    openings = [...design.windows, ...design.doors].map(o => ({ opening: o, line: openingLine(design, o) })),
    fontSize = Math.max(design.plot.width, design.plot.length) / 30;
  const pieces = useMemo(() => design.furniture.filter(p => p.floor === floor).flatMap(p => {
    const item = itemFor(design, p.catalogId);
    return item && layerOf(item) === "floor" ? [{ p, points: footprint(item, p) }] : [];
  }), [design, floor]);
  return <>
    {design.plot.polygon?.length ? <polygon className="walk-map-plot" points={design.plot.polygon.map(p => `${p.x},${p.y}`).join(" ")} />
      : <rect className="walk-map-plot" x={0} y={0} width={design.plot.width} height={design.plot.length} />}
    {rooms.map(r => <rect key={r.id} x={r.x} y={r.y} width={r.width} height={r.length}
      className={`walk-map-room${isOpenAir(r.type) ? " is-outdoor" : ""}${r.id === roomId ? " is-current" : ""}`}
      data-room-id={r.id} data-current={r.id === roomId}><title>{r.name}</title></rect>)}
    {pieces.map(({ p, points }) => <polygon key={p.id} className="walk-map-furniture" points={points.map(q => `${q.x},${q.y}`).join(" ")} />)}
    {openings.filter(o => o.line?.floor === floor).map(({ opening: o, line: p }) => p && <line key={o.id}
      x1={p.horizontal ? p.start : p.line} y1={p.horizontal ? p.line : p.start}
      x2={p.horizontal ? p.end : p.line} y2={p.horizontal ? p.line : p.end}
      className={"doorType" in o ? "walk-map-door" : "walk-map-window"} />)}
    {rooms.map(r => {
      const x = r.x + r.width / 2, y = r.y + r.length / 2,
        vertical = r.length > r.width * 2,
        available = vertical ? r.length : r.width,
        max = Math.max(3, Math.floor(available / (fontSize * 0.56))),
        name = shortName(r), label = name.length > max ? `${name.slice(0, max - 1)}…` : name;
      return <text key={r.id} x={x} y={y} fontSize={fontSize} textAnchor="middle" dominantBaseline="central"
        transform={vertical ? `rotate(-90 ${x} ${y})` : undefined}
        className={`walk-map-label${r.id === roomId ? " is-current" : ""}`}>{label}</text>;
    })}
  </>;
});

/** Small, north-up map. Position and heading are real camera telemetry, including production builds. */
export function WalkMinimap({ design, location }: { design: HomeDesign; location: WalkLocation | null }) {
  const [expanded, setExpanded] = useState(true), mapId = useId(),
    floor = location?.floor ?? 0, span = Math.max(design.plot.width, design.plot.length),
    pad = Math.max(3, span * 0.06), marker = span / 35,
    x = Math.max(-pad + marker, Math.min(design.plot.width + pad - marker, location?.x ?? 0)),
    y = Math.max(-pad + marker, Math.min(design.plot.length + pad - marker, location?.y ?? 0)),
    heading = ((location?.heading ?? 0) % 360 + 360) % 360,
    facing = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(heading / 45) % 8],
    name = location?.roomName ?? "Locating…";
  return <aside className={`walk-minimap${expanded ? "" : " is-collapsed"}`} data-testid="walk-minimap" data-floor={floor} aria-label="Walk navigation mini-map">
    <div className="walk-map-header">
      <span className="walk-map-eyebrow">YOU ARE HERE</span>
      <button type="button" className="walk-map-toggle" aria-label={expanded ? "Hide mini-map" : "Show mini-map"}
        aria-expanded={expanded} aria-controls={mapId} onClick={() => setExpanded(v => !v)}>{expanded ? "−" : "+"}</button>
    </div>
    <p className="walk-map-location" role="status" aria-live="polite" aria-atomic="true" data-testid="walk-current-room" data-room-id={location?.roomId ?? "outside"}>
      <strong>{name}</strong><span>{floorLabel(floor)}{location?.onStairs ? " · On stairs" : ""}</span>
    </p>
    {expanded && <div className="walk-map-body" id={mapId}>
      <div className="walk-map-compass" aria-hidden="true"><span>↑ N</span><span>Facing {facing}</span></div>
      <svg data-testid="walk-map-plan" role="img" aria-label={`${floorLabel(floor)} mini-map. You are in ${name}, facing ${facing}.`}
        viewBox={`${-pad} ${-pad} ${design.plot.width + pad * 2} ${design.plot.length + pad * 2}`}>
        <MapPlan design={design} floor={floor} roomId={location?.roomId ?? null} />
        {location && <g data-testid="walk-map-player" data-x={location.x} data-y={location.y} data-heading={heading}
          transform={`translate(${x} ${y}) rotate(${heading}) scale(${marker})`}>
          <path className="walk-map-sight" d="M0 0 L-2.6 -4.2 Q0 -5.3 2.6 -4.2 Z" />
          <circle className="walk-map-player-halo" r="1.05" />
          <path className="walk-map-player" d="M0 -1.1 L.75 .75 L0 .4 L-.75 .75 Z" />
        </g>}
      </svg>
      <div className="walk-map-legend"><span><i className="walk-map-legend-you" />You</span><span><i className="walk-map-legend-room" />Current room</span></div>
    </div>}
  </aside>;
}
