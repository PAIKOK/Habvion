import type { Point, Rect } from "../types/home";
import { EPS, rotatedCorners } from "../lib/geometry";
import type { Solid } from "./furnitureSolids";

export const WALK_RADIUS = 0.65;
export type Barrier = { rect: Rect; bottom: number; top: number; kind?: "structure" | "furniture"; pieceId?: string; shape?: { centre: Point; rotation: number; width: number; depth: number; round?: boolean } };

export function placedSolid(s: Solid, at: Point & { rotation: number }, base: number, pieceId?: string): Barrier {
  const a = at.rotation * Math.PI / 180;
  const centre = { x: at.x + s.x * Math.cos(a) - s.y * Math.sin(a), y: at.y + s.x * Math.sin(a) + s.y * Math.cos(a) };
  const points = rotatedCorners({ x: centre.x - s.width / 2, y: centre.y - s.depth / 2, width: s.width, length: s.depth }, at.rotation);
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { rect: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), length: Math.max(...ys) - Math.min(...ys) }, bottom: base + s.bottom, top: base + s.top, kind: "furniture", pieceId, shape: { centre, rotation: at.rotation, width: s.width, depth: s.depth, round: s.round } };
}

/** Signed distance and outward normal. A rotated box is NOT its axis-aligned bounds. */
export function contact(p: Point, b: Barrier): { distance: number; normal: Point } {
  const shape = b.shape, r = b.rect;
  const centre = shape?.centre ?? { x: r.x + r.width / 2, y: r.y + r.length / 2 },
    angle = (shape?.rotation ?? 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle),
    dx = p.x - centre.x, dy = p.y - centre.y,
    x = dx * c + dy * s, y = -dx * s + dy * c,
    w = (shape?.width ?? r.width) / 2, d = (shape?.depth ?? r.length) / 2;
  if (shape?.round) {
    const length = Math.hypot(dx, dy);
    return { distance: length - Math.min(w, d), normal: length > EPS ? { x: dx / length, y: dy / length } : { x: 1, y: 0 } };
  }
  const qx = Math.abs(x) - w, qy = Math.abs(y) - d;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), outside = Math.hypot(ox, oy);
  let nx: number, ny: number;
  if (outside > EPS) { nx = Math.sign(x) * ox / outside; ny = Math.sign(y) * oy / outside; }
  else if (qx > qy) { nx = x < 0 ? -1 : 1; ny = 0; }
  else { nx = 0; ny = y < 0 ? -1 : 1; }
  return { distance: outside + Math.min(Math.max(qx, qy), 0), normal: { x: nx * c - ny * s, y: nx * s + ny * c } };
}
