import type {
  Door,
  FurnitureItem,
  HomeDesign,
  PlacedFurniture,
  Point,
  Rect,
  Room,
  Side,
} from "../types/home";
import {
  EPS,
  overlap,
  pointInPolygon,
  polygonsOverlap,
  rotatedCorners,
  corners,
} from "../lib/geometry";
import { itemFor, suits } from "./catalog";
import { doorSweep, openingLine, sideNormal } from "./walls";
import { stairWell } from "./stairs";
import { pieceSchema } from "./schemas";
import { issue, type Issue, type ValidationResult } from "./actions";
import { ROOM_INFO } from "./roomTypes";

/** Rotation that backs an item onto a wall and faces it into the room. */
export const ROTATION_FOR_WALL: Record<Side, number> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};
const norm = (r: number) => ((Math.round(r) % 360) + 360) % 360;
/** The wall an item backs onto at this rotation (only for right angles). */
export function backSide(rotation: number): Side | null {
  const r = norm(rotation);
  return r === 0 ? "north" : r === 90 ? "east" : r === 180 ? "south" : r === 270 ? "west" : null;
}
/** Plan polygon of a placed item. x/y is its centre. */
export function footprint(item: FurnitureItem, p: Pick<PlacedFurniture, "x" | "y" | "rotation">) {
  return rotatedCorners(
    { x: p.x - item.width / 2, y: p.y - item.depth / 2, width: item.width, length: item.depth },
    p.rotation,
  );
}
export function footprintBounds(
  item: FurnitureItem,
  p: Pick<PlacedFurniture, "x" | "y" | "rotation">,
): Rect {
  const pts = footprint(item, p),
    xs = pts.map((q) => q.x),
    ys = pts.map((q) => q.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    length: Math.max(...ys) - Math.min(...ys),
  };
}
type Layer = "floor" | "rug" | "wall" | "ceiling" | "surface" | "canopy" | "drape";
export function layerOf(item: FurnitureItem): Layer {
  if (item.shape === "rug") return "rug";
  if (item.shape === "curtain") return "drape";
  if (item.shape === "pergola") return "canopy";
  return item.mount;
}
/** Vertical span above the floor, feet. */
export function verticalSpan(item: FurnitureItem): [number, number] {
  const base = item.mount === "wall" ? (item.mountHeightFt ?? 4) : 0;
  return [base, base + item.height];
}
function collides(a: FurnitureItem, b: FurnitureItem) {
  const la = layerOf(a),
    lb = layerOf(b);
  if (la === "rug" || lb === "rug" || la === "drape" || lb === "drape") return false;
  if (la === "canopy" || lb === "canopy") return la === lb;
  if (la === "ceiling" || lb === "ceiling") return la === lb;
  if (la === "surface" || lb === "surface") return la === lb;
  if (la === "floor" && lb === "floor") return true;
  // A wall item clashes with whatever occupies the same height.
  const [a0, a1] = verticalSpan(a),
    [b0, b1] = verticalSpan(b);
  return a0 < b1 - EPS && b0 < a1 - EPS;
}
/** Zones a door needs clear: its swing, and a two-foot landing on each side. */
export function doorClearZones(d: HomeDesign, door: Door): Rect[] {
  const p = openingLine(d, door);
  if (!p) return [];
  const sweep = doorSweep(d, door),
    n = sideNormal(door.side),
    strip = (dir: number): Rect =>
      p.horizontal
        ? { x: p.start, y: dir * n.y > 0 ? p.line : p.line - 2, width: door.width, length: 2 }
        : { x: dir * n.x > 0 ? p.line : p.line - 2, y: p.start, width: 2, length: door.width };
  return sweep ? [sweep, strip(-1)] : [strip(1), strip(-1)];
}
const rectPoly = (r: Rect) => corners(r);

export function validateFurniture(d: HomeDesign, piece: PlacedFurniture): ValidationResult {
  const parsed = pieceSchema.safeParse(piece);
  if (!parsed.success)
    return {
      ok: false,
      issues: [issue("furniture/invalid", parsed.error.issues[0]!.message, [piece.id])],
    };
  const item = itemFor(d, piece.catalogId);
  if (!item)
    return {
      ok: false,
      issues: [issue("furniture/unknown-item", "That item is not in the catalog.", [piece.id])],
    };
  const room = d.rooms.find((r) => r.id === piece.roomId),
    issues: Issue[] = [],
    ids = [piece.id];
  if (!room || room.floor !== piece.floor)
    return {
      ok: false,
      issues: [issue("furniture/no-room", `${item.name} must be placed in a room.`, ids)],
    };
  const poly = footprint(item, piece),
    layer = layerOf(item);
  if (!poly.every((q) => pointInPolygon(q, rectPoly(room))))
    issues.push(
      issue("furniture/outside-room", `${item.name} does not fit inside ${room.name}.`, ids),
    );
  for (const other of d.furniture) {
    if (other.id === piece.id || other.floor !== piece.floor) continue;
    const o = itemFor(d, other.catalogId);
    if (o && collides(item, o) && polygonsOverlap(poly, footprint(o, other)))
      issues.push(
        issue("furniture/collision", `${item.name} collides with ${o.name}.`, [piece.id, other.id]),
      );
  }
  if (layer !== "ceiling" && layer !== "canopy") {
    for (const s of d.stairs) {
      const blocked =
        s.fromFloor === piece.floor ? s : s.toFloor === piece.floor ? stairWell(d, s) : null;
      if (blocked && polygonsOverlap(poly, rectPoly(blocked)))
        issues.push(
          issue(
            "furniture/on-stair",
            s.fromFloor === piece.floor
              ? `${item.name} stands on the stair.`
              : `${item.name} is over the open stairwell.`,
            [piece.id, s.id],
          ),
        );
    }
    const low = layer !== "wall" || verticalSpan(item)[0] < 7;
    if (low && layer !== "rug")
      for (const door of d.doors) {
        const dr = d.rooms.find((r) => r.id === door.roomId);
        if (!dr || dr.floor !== piece.floor) continue;
        if (doorClearZones(d, door).some((z) => polygonsOverlap(poly, rectPoly(z))))
          issues.push(
            issue("furniture/blocks-door", `${item.name} blocks a door's swing or landing.`, [
              piece.id,
              door.id,
            ]),
          );
      }
  }
  if (item.mount === "wall") {
    const side = backSide(piece.rotation),
      b = footprintBounds(item, piece),
      gap =
        side === "north"
          ? b.y - room.y
          : side === "south"
            ? room.y + room.length - b.y - b.length
            : side === "west"
              ? b.x - room.x
              : side === "east"
                ? room.x + room.width - b.x - b.width
                : Infinity;
    if (gap > 0.75)
      issues.push(issue("furniture/not-on-wall", `${item.name} must be fixed to a wall.`, ids));
  }
  if (item.mount === "surface") {
    const b = footprintBounds(item, piece),
      support = d.furniture.some((o) => {
        if (o.id === piece.id || o.floor !== piece.floor) return false;
        const oi = itemFor(d, o.catalogId);
        if (!oi || oi.mount !== "floor" || oi.shape === "rug" || oi.height < 1) return false;
        const ob = footprintBounds(oi, o);
        return (
          b.x >= ob.x - 0.25 &&
          b.y >= ob.y - 0.25 &&
          b.x + b.width <= ob.x + ob.width + 0.25 &&
          b.y + b.length <= ob.y + ob.length + 0.25
        );
      });
    if (!support)
      issues.push(
        issue(
          "furniture/unsupported",
          `${item.name} needs a counter, table or cabinet under it.`,
          ids,
        ),
      );
  }
  if (!suits(item, room.type))
    issues.push(
      issue(
        "furniture/unsuitable",
        `${item.name} is unusual in a ${ROOM_INFO[room.type].label.toLowerCase()}.`,
        ids,
        "warning",
      ),
    );
  return { ok: !issues.some((i) => i.level === "error"), issues };
}

export type Spot = { x: number; y: number; rotation: number };
/**
 * First valid spot for an item in a room. Wall-hugging positions first (each wall,
 * facing into the room), then free-standing, then on top of something for surface
 * items. Returns null rather than ever placing something invalid.
 */
export function findFurnitureSpot(
  d: HomeDesign,
  roomId: string,
  catalogId: string,
  opts: { sides?: Side[]; freeStanding?: boolean; near?: Point } = {},
): Spot | null {
  const room = d.rooms.find((r) => r.id === roomId),
    item = itemFor(d, catalogId);
  if (!room || !item) return null;
  const ok = (s: Spot) =>
    validateFurniture(d, {
      id: "__candidate",
      catalogId,
      roomId,
      floor: room.floor,
      ...s,
    }).ok;
  const candidates: Spot[] = [];
  if (item.mount === "surface") {
    for (const o of d.furniture.filter((f) => f.roomId === roomId)) {
      const oi = itemFor(d, o.catalogId);
      if (oi && oi.mount === "floor" && oi.height >= 1)
        candidates.push({ x: o.x, y: o.y, rotation: o.rotation });
    }
  } else if (item.mount === "ceiling" || opts.freeStanding) {
    candidates.push({ x: room.x + room.width / 2, y: room.y + room.length / 2, rotation: 0 });
    candidates.push(...grid(room, item, 0));
  } else {
    for (const side of opts.sides ?? (["north", "east", "south", "west"] as Side[]))
      candidates.push(...alongWall(room, item, side));
    if (item.mount === "floor") candidates.push(...grid(room, item, 0));
  }
  if (opts.near) {
    const n = opts.near;
    candidates.sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y));
  }
  return candidates.find(ok) ?? null;
}
/** Centres along one wall, middle-out, backed onto it. */
export function alongWall(room: Room, item: FurnitureItem, side: Side, step = 0.5): Spot[] {
  const rotation = ROTATION_FOR_WALL[side],
    horizontal = side === "north" || side === "south",
    span = horizontal ? room.width : room.length,
    half = item.width / 2,
    out: Spot[] = [];
  if (span < item.width - EPS) return out;
  const offsets: number[] = [];
  const mid = span / 2;
  for (let k = 0; mid - k * step >= half - EPS || mid + k * step <= span - half + EPS; k++) {
    if (mid + k * step <= span - half + EPS) offsets.push(mid + k * step);
    if (k && mid - k * step >= half - EPS) offsets.push(mid - k * step);
  }
  const inset = item.depth / 2 + 0.01;
  for (const o of offsets)
    out.push(
      side === "north"
        ? { x: room.x + o, y: room.y + inset, rotation }
        : side === "south"
          ? { x: room.x + o, y: room.y + room.length - inset, rotation }
          : side === "west"
            ? { x: room.x + inset, y: room.y + o, rotation }
            : { x: room.x + room.width - inset, y: room.y + o, rotation },
    );
  return out;
}
function grid(room: Room, item: FurnitureItem, rotation: number): Spot[] {
  const out: Spot[] = [],
    w = item.width / 2,
    h = item.depth / 2;
  for (let y = room.y + h; y <= room.y + room.length - h + EPS; y += 0.5)
    for (let x = room.x + w; x <= room.x + room.width - w + EPS; x += 0.5)
      out.push({ x, y, rotation });
  return out;
}
/** Placed pieces whose footprint touches a rect (used by audit and the 3D view). */
export const piecesIn = (d: HomeDesign, r: Rect) =>
  d.furniture.filter((p) => {
    const item = itemFor(d, p.catalogId);
    return item && overlap(footprintBounds(item, p), r);
  });
