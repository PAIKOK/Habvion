import type { HomeDesign, Point, Rect } from "../types/home";
import { deriveWalls, wallPanels } from "./walls";
import { stairParts, stairWell, wellGuards } from "./stairs";
import { compoundSegments } from "./finishes";
import { itemFor } from "./catalog";
import { footprintBounds, layerOf } from "./furniture";
import { EPS, pointInPolygon, subtractAll } from "../lib/geometry";
import { elevation, roomFloorY } from "./levels";
import { leadsOutside } from "./audit";

/** A person: steps up to a foot, stands 5'5" at the eye, is 1.5 ft across. */
export const STEP = 1;
export const EYE = 5.4;
export const RADIUS = 0.75;
export type Barrier = { rect: Rect; bottom: number; top: number };
export type Surface = { pts: Point[]; top: number };
const thin = (a: Point, b: Point, t: number): Rect =>
  Math.abs(a.y - b.y) < EPS
    ? { x: Math.min(a.x, b.x), y: a.y - t / 2, width: Math.abs(b.x - a.x), length: t }
    : { x: a.x - t / 2, y: Math.min(a.y, b.y), width: t, length: Math.abs(b.y - a.y) };
const poly = (r: Rect): Point[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.length },
  { x: r.x, y: r.y + r.length },
];

/** Everything that can stop a walker, each with the height band it occupies. */
export function barriers(d: HomeDesign): Barrier[] {
  const out: Barrier[] = [];
  for (const w of deriveWalls(d)) {
    const base = elevation(d, w.floor),
      h = Math.abs(w.a.y - w.b.y) < EPS,
      start = h ? w.a.x : w.a.y;
    for (const p of wallPanels(d, w)) {
      const a = h ? { x: start + p.along, y: w.a.y } : { x: w.a.x, y: start + p.along },
        b = h ? { x: start + p.along + p.width, y: w.a.y } : { x: w.a.x, y: start + p.along + p.width };
      out.push({ rect: thin(a, b, w.thickness), bottom: base + p.bottom, top: base + p.bottom + p.height });
    }
  }
  if (d.compound)
    for (const [a, b] of compoundSegments(d.plot, d.compound))
      out.push({ rect: thin(a, b, d.compound.thickness), bottom: 0, top: d.compound.height });
  for (const p of d.furniture) {
    const item = itemFor(d, p.catalogId),
      room = d.rooms.find((r) => r.id === p.roomId);
    if (!item || !room) continue;
    const layer = layerOf(item);
    if (layer === "rug" || layer === "ceiling" || layer === "surface" || layer === "drape") continue;
    const floorY = roomFloorY(d, room),
      bottom = item.mount === "wall" ? floorY + (item.mountHeightFt ?? 4) : floorY;
    if (layer === "canopy") {
      // A pergola stops you only at its posts.
      const b = footprintBounds(item, p);
      for (const [x, y] of [[b.x, b.y], [b.x + b.width - 0.45, b.y], [b.x, b.y + b.length - 0.45], [b.x + b.width - 0.45, b.y + b.length - 0.45]] as const)
        out.push({ rect: { x, y, width: 0.45, length: 0.45 }, bottom, top: bottom + item.height });
      continue;
    }
    out.push({ rect: footprintBounds(item, p), bottom, top: bottom + item.height });
  }
  // The open edges of a stairwell upstairs are guarded.
  for (const s of d.stairs) {
    const top = elevation(d, s.toFloor);
    for (const rect of wellGuards(d, s)) out.push({ rect, bottom: top, top: top + 3.3 });
  }
  return out;
}
/** Walkable surfaces: the ground, every room's floor (less stairwells) and every tread. */
export function surfaces(d: HomeDesign): Surface[] {
  const out: Surface[] = [{ pts: poly({ x: -60, y: -60, width: d.plot.width + 120, length: d.plot.length + 120 }), top: 0 }];
  for (const r of d.rooms) {
    const wells = d.stairs.filter((s) => s.toFloor === r.floor).map((s) => stairWell(d, s)).filter((w): w is Rect => !!w);
    for (const p of subtractAll(r, wells)) out.push({ pts: poly(p), top: roomFloorY(d, r) });
  }
  for (const s of d.stairs) {
    const base = elevation(d, s.fromFloor);
    for (const p of stairParts(d, s)) out.push({ pts: p.pts, top: base + p.z });
  }
  return out;
}
/** The surface a walker at `feet` height ends up standing on: the highest one within a step. */
export function groundAt(all: Surface[], p: Point, feet: number) {
  let best = -Infinity;
  for (const s of all)
    if (s.top <= feet + STEP + EPS && s.top > best && pointInPolygon(p, s.pts)) best = s.top;
  return best === -Infinity ? 0 : best;
}
const gap = (p: Point, r: Rect) => {
  const cx = Math.max(r.x, Math.min(p.x, r.x + r.width)),
    cy = Math.max(r.y, Math.min(p.y, r.y + r.length));
  return Math.hypot(p.x - cx, p.y - cy);
};
const hits = (p: Point, r: Rect) => gap(p, r) < RADIUS;
/** Barriers count only if they reach above a step and below the walker's head. */
export const blocks = (b: Barrier, feet: number) => b.top > feet + STEP + EPS && b.bottom < feet + EYE;
/** Move by delta, sliding along whatever is in the way. */
export function walk(all: Barrier[], from: Point, delta: Point, feet: number): Point {
  // A walker already touching something may move, but never closer to it.
  const active = all.filter((b) => blocks(b, feet)),
    free = (p: Point) =>
      !active.some((b) => hits(p, b.rect) && (!hits(from, b.rect) || gap(p, b.rect) < gap(from, b.rect) - EPS));
  const both = { x: from.x + delta.x, y: from.y + delta.y };
  if (free(both)) return both;
  const xOnly = { x: from.x + delta.x, y: from.y };
  if (free(xOnly)) return xOnly;
  const yOnly = { x: from.x, y: from.y + delta.y };
  if (free(yOnly)) return yOnly;
  return from;
}
/** Where a visitor starts: just outside the main entrance, facing in. */
export function startPosition(d: HomeDesign): { p: Point; heading: number } {
  const entrance = d.doors.find((o) => {
    const r = d.rooms.find((x) => x.id === o.roomId);
    return r && r.floor === 0 && leadsOutside(d, o);
  });
  if (!entrance) return { p: { x: d.plot.width / 2, y: d.plot.length + 4 }, heading: 0 };
  const r = d.rooms.find((x) => x.id === entrance.roomId)!,
    out = 2.5,
    p =
      entrance.side === "north"
        ? { x: r.x + entrance.offset, y: r.y - out }
        : entrance.side === "south"
          ? { x: r.x + entrance.offset, y: r.y + r.length + out }
          : entrance.side === "west"
            ? { x: r.x - out, y: r.y + entrance.offset }
            : { x: r.x + r.width + out, y: r.y + entrance.offset };
  // Heading: 0 looks north (−y), measured clockwise.
  const heading = { north: 180, south: 0, west: 90, east: 270 }[entrance.side];
  return { p, heading };
}
