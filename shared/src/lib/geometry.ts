import type { Point, Plot, Rect, Side } from "../types/home";
export const EPS = 1e-6;
export const SIDES: Side[] = ["north", "east", "south", "west"];
export const area = (r: Rect) => r.width * r.length;
export const contains = (a: Rect, b: Rect, margin = 0) =>
  b.x >= a.x + margin - EPS &&
  b.y >= a.y + margin - EPS &&
  b.x + b.width <= a.x + a.width - margin + EPS &&
  b.y + b.length <= a.y + a.length - margin + EPS;
export const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width - EPS &&
  a.x + a.width > b.x + EPS &&
  a.y < b.y + b.length - EPS &&
  a.y + a.length > b.y + EPS;
export const intersection = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y),
    width = Math.min(a.x + a.width, b.x + b.width) - x,
    length = Math.min(a.y + a.length, b.y + b.length) - y;
  return width > EPS && length > EPS ? { x, y, width, length } : null;
};
export const corners = (r: Rect): Point[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.length },
  { x: r.x, y: r.y + r.length },
];
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function pointInPolygon(p: Point, points: Point[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      Math.abs(cross(a, b, p)) < EPS &&
      p.x >= Math.min(a.x, b.x) - EPS &&
      p.x <= Math.max(a.x, b.x) + EPS &&
      p.y >= Math.min(a.y, b.y) - EPS &&
      p.y <= Math.max(a.y, b.y) + EPS
    )
      return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function withinPlot(plot: Plot, r: Rect) {
  if (!contains({ x: 0, y: 0, width: plot.width, length: plot.length }, r)) return false;
  if (!plot.polygon) return true;
  const cs = corners(r);
  if (!cs.every((p) => pointInPolygon(p, plot.polygon!))) return false; // sample edges too, so concave notches cannot be bridged
  return cs.every((a, i) => {
    const b = cs[(i + 1) % 4]!;
    for (let t = 0; t <= 1; t += 0.025)
      if (!pointInPolygon({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, plot.polygon!))
        return false;
    return true;
  });
}
export const edgeLength = (r: Rect, side: Side) =>
  side === "north" || side === "south" ? r.width : r.length;
export function onSide(r: Rect, side: Side, offset: number): Point {
  return side === "north"
    ? { x: r.x + offset, y: r.y }
    : side === "south"
      ? { x: r.x + offset, y: r.y + r.length }
      : side === "east"
        ? { x: r.x + r.width, y: r.y + offset }
        : { x: r.x, y: r.y + offset };
}
export function setbacksBySide(plot: Plot): Record<Side, number> {
  const n = SIDES.indexOf(plot.roadSide),
    s = plot.setbacks;
  return {
    [SIDES[n]!]: s.front,
    [SIDES[(n + 1) % 4]!]: s.left,
    [SIDES[(n + 2) % 4]!]: s.rear,
    [SIDES[(n + 3) % 4]!]: s.right,
  } as Record<Side, number>;
}
export function buildableRect(plot: Plot): Rect {
  const s = setbacksBySide(plot);
  return {
    x: s.west,
    y: s.north,
    width: Math.max(0, plot.width - s.west - s.east),
    length: Math.max(0, plot.length - s.north - s.south),
  };
}
export function subtractRect(base: Rect, hole: Rect): Rect[] {
  const i = intersection(base, hole);
  if (!i) return [base];
  const out = [
    { x: base.x, y: base.y, width: base.width, length: i.y - base.y },
    {
      x: base.x,
      y: i.y + i.length,
      width: base.width,
      length: base.y + base.length - i.y - i.length,
    },
    { x: base.x, y: i.y, width: i.x - base.x, length: i.length },
    { x: i.x + i.width, y: i.y, width: base.x + base.width - i.x - i.width, length: i.length },
  ];
  return out.filter((r) => r.width > EPS && r.length > EPS);
}
export const subtractAll = (base: Rect, holes: Rect[]) =>
  holes.reduce((parts, h) => parts.flatMap((p) => subtractRect(p, h)), [base]);
export function rotatedCorners(r: Rect, rotation: number): Point[] {
  const cx = r.x + r.width / 2,
    cy = r.y + r.length / 2,
    a = (rotation * Math.PI) / 180;
  return corners(r).map((p) => ({
    x: cx + (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a),
    y: cy + (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a),
  }));
}
export function polygonsOverlap(a: Point[], b: Point[]) {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!,
        q = poly[(i + 1) % poly.length]!,
        axis = { x: -(q.y - p.y), y: q.x - p.x };
      const av = a.map((v) => v.x * axis.x + v.y * axis.y),
        bv = b.map((v) => v.x * axis.x + v.y * axis.y);
      if (Math.max(...av) <= Math.min(...bv) + EPS || Math.max(...bv) <= Math.min(...av) + EPS)
        return false;
    }
  return true;
}
