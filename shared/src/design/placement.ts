import type { HomeDesign, RoomType, Point } from "../types/home";
import { ROOM_INFO } from "./roomTypes";
import { validateRoom } from "./validation";
import { buildableRect } from "../lib/geometry";
/**
 * First free spot for a default-sized room. Scans the buildable area (inside the
 * setbacks) first, and only falls back to the whole plot when nothing fits there.
 */
export function freeRoomSpot(d: HomeDesign, type: RoomType, floor: number): Point | null {
  const info = ROOM_INFO[type],
    b = buildableRect(d.plot),
    whole = { x: 0, y: 0, width: d.plot.width, length: d.plot.length };
  for (const area of [b, whole])
    for (let y = area.y; y <= area.y + area.length - info.length + 1e-9; y += 0.5)
      for (let x = area.x; x <= area.x + area.width - info.width + 1e-9; x += 0.5) {
        const candidate = {
          id: "candidate",
          name: info.label,
          type,
          x,
          y,
          width: info.width,
          length: info.length,
          floor,
        };
        const v = validateRoom(d, candidate);
        if (v.ok && (area === whole || !v.issues.length)) return { x, y };
      }
  return null;
}
export function snapPoint(p: Point, rooms: HomeDesign["rooms"], enabled = true): Point {
  if (!enabled) return p;
  const xs = rooms.flatMap((r) => [r.x, r.x + r.width]),
    ys = rooms.flatMap((r) => [r.y, r.y + r.length]);
  const snap = (v: number, edges: number[]) =>
    edges.reduce(
      (best, n) => (Math.abs(n - v) < 0.3 && Math.abs(n - v) < Math.abs(best - v) ? n : best),
      Math.round(v * 2) / 2,
    );
  return { x: snap(p.x, xs), y: snap(p.y, ys) };
}
