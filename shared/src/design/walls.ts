import type { HomeDesign, Room, Side, Point, Opening, Door, Rect } from "../types/home";
import { isOpenAir } from "./roomTypes";
import { EPS, onSide } from "../lib/geometry";
import { DOOR_TYPES } from "./openingTypes";
export type WallOwner = { roomId: string; side: Side };
export type Wall = {
  id: string;
  floor: number;
  a: Point;
  b: Point;
  height: number;
  thickness: number;
  owners: WallOwner[];
  exterior: boolean;
  open: boolean;
};
const round = (n: number) => Number(n.toFixed(6));
/**
 * Walls depend only on rooms and floors, and designs are never mutated, so the walls
 * derived for one pair of arrays are reused until either is replaced.
 */
const wallCache = new WeakMap<HomeDesign["rooms"], { floors: HomeDesign["floors"]; walls: Wall[] }>();
export function deriveWalls(d: HomeDesign): Wall[] {
  const hit = wallCache.get(d.rooms);
  if (hit && hit.floors === d.floors) return hit.walls;
  const walls = computeWalls(d);
  wallCache.set(d.rooms, { floors: d.floors, walls });
  return walls;
}
function computeWalls(d: HomeDesign): Wall[] {
  type Claim = {
    floor: number;
    horizontal: boolean;
    line: number;
    start: number;
    end: number;
    height: number;
    owner: WallOwner;
    open: boolean;
  };
  const groups = new Map<string, Claim[]>();
  for (const r of d.rooms)
    for (const side of ["north", "east", "south", "west"] as const) {
      const horizontal = side === "north" || side === "south",
        line = horizontal
          ? r.y + (side === "south" ? r.length : 0)
          : r.x + (side === "east" ? r.width : 0),
        start = horizontal ? r.x : r.y,
        end = start + (horizontal ? r.width : r.length),
        open = isOpenAir(r.type),
        height = open
          ? r.floor > 0 || r.type === "balcony" || r.type === "terrace"
            ? 3.5
            : 0
          : d.floors[r.floor]!.height,
        key = `${r.floor}:${horizontal ? "h" : "v"}:${round(line)}`;
      const group = groups.get(key) ?? [];
      group.push({
        floor: r.floor,
        horizontal,
        line,
        start,
        end,
        height,
        owner: { roomId: r.id, side },
        open,
      });
      groups.set(key, group);
    }
  const walls: Wall[] = [];
  for (const [key, claims] of groups) {
    const breaks = [...new Set(claims.flatMap((c) => [round(c.start), round(c.end)]))].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < breaks.length - 1; i++) {
      const start = breaks[i]!,
        end = breaks[i + 1]!,
        mid = (start + end) / 2,
        owners = claims.filter((c) => mid > c.start - EPS && mid < c.end + EPS);
      if (!owners.length) continue;
      const first = owners[0]!,
        height =
          owners.length > 1 && owners.every((c) => c.open)
            ? 0
            : Math.max(...owners.map((c) => c.height));
      if (height <= EPS) continue;
      const open = owners.every((c) => c.open),
        exterior = owners.length === 1;
      walls.push({
        id: `wall-${key}-${start}-${end}`,
        floor: first.floor,
        a: first.horizontal ? { x: start, y: first.line } : { x: first.line, y: start },
        b: first.horizontal ? { x: end, y: first.line } : { x: first.line, y: end },
        height,
        thickness: open ? 0.25 : exterior ? 0.5 : 0.33,
        owners: owners.map((c) => c.owner),
        exterior,
        open,
      });
    }
  }
  return walls;
}
export function openingLine(d: HomeDesign, o: Opening) {
  const r = d.rooms.find((r) => r.id === o.roomId);
  if (!r) return null;
  const center = onSide(r, o.side, o.offset),
    h = o.side === "north" || o.side === "south";
  return {
    room: r,
    floor: r.floor,
    horizontal: h,
    line: h ? center.y : center.x,
    start: (h ? center.x : center.y) - o.width / 2,
    end: (h ? center.x : center.y) + o.width / 2,
    center,
  };
}
/** Whether an opening's span overlaps a wall's run. */
export function spanOnWall(p: NonNullable<ReturnType<typeof openingLine>>, w: Wall) {
  const h = Math.abs(w.a.y - w.b.y) < EPS,
    line = h ? w.a.y : w.a.x,
    start = h ? w.a.x : w.a.y,
    end = h ? w.b.x : w.b.y;
  return p.floor === w.floor && p.horizontal === h && Math.abs(p.line - line) < EPS && p.start < end - EPS && p.end > start + EPS;
}
export function openingsOn(d: HomeDesign, w: Wall) {
  return [...d.doors, ...d.windows].filter((o) => {
    const p = openingLine(d, o);
    return !!p && spanOnWall(p, w);
  });
}
export function wallPanels(
  d: HomeDesign,
  w: Wall,
): { along: number; width: number; bottom: number; height: number }[] {
  const h = Math.abs(w.a.y - w.b.y) < EPS,
    start = h ? w.a.x : w.a.y,
    end = h ? w.b.x : w.b.y,
    holes = openingsOn(d, w).map((o) => {
      const p = openingLine(d, o)!;
      return {
        start: Math.max(start, p.start),
        end: Math.min(end, p.end),
        bottom: "sill" in o ? (o.sill as number) : 0,
        top: Math.min(w.height, ("sill" in o ? (o.sill as number) : 0) + o.height),
      };
    }),
    breaks = [...new Set([start, end, ...holes.flatMap((o) => [o.start, o.end])])].sort(
      (a, b) => a - b,
    ),
    out: { along: number; width: number; bottom: number; height: number }[] = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i]!,
      b = breaks[i + 1]!,
      mid = (a + b) / 2,
      spans = holes
        .filter((o) => mid > o.start - EPS && mid < o.end + EPS)
        .map((o) => [o.bottom, o.top])
        .sort((a, b) => a[0]! - b[0]!);
    let bottom = 0;
    for (const [lo, hi] of spans) {
      if (lo! > bottom + EPS)
        out.push({ along: a - start, width: b - a, bottom, height: lo! - bottom });
      bottom = Math.max(bottom, hi!);
    }
    if (bottom < w.height - EPS)
      out.push({ along: a - start, width: b - a, bottom, height: w.height - bottom });
  }
  return out;
}
export function sideNormal(side: Side): Point {
  return side === "north"
    ? { x: 0, y: 1 }
    : side === "south"
      ? { x: 0, y: -1 }
      : side === "west"
        ? { x: 1, y: 0 }
        : { x: -1, y: 0 };
}
export function doorSweep(d: HomeDesign, door: Door): Rect | null {
  if (!DOOR_TYPES[door.doorType].swings) return null;
  const p = openingLine(d, door);
  if (!p) return null;
  const n = sideNormal(door.side),
    h = p.horizontal;
  return h
    ? {
        x: p.start,
        y: p.center.y + (n.y < 0 ? -door.width : 0),
        width: door.width,
        length: door.width,
      }
    : {
        x: p.center.x + (n.x < 0 ? -door.width : 0),
        y: p.start,
        width: door.width,
        length: door.width,
      };
}
export function roomSides(r: Room) {
  return {
    north: { a: onSide(r, "north", 0), b: onSide(r, "north", r.width) },
    east: { a: onSide(r, "east", 0), b: onSide(r, "east", r.length) },
    south: { a: onSide(r, "south", 0), b: onSide(r, "south", r.width) },
    west: { a: onSide(r, "west", 0), b: onSide(r, "west", r.length) },
  };
}
