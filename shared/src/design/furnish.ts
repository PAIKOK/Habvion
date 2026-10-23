import type { HomeDesign, PlacedFurniture, Room, RoomType, Side } from "../types/home";
import { applyAction } from "./reducer";
import { itemFor } from "./catalog";
import { ROTATION_FOR_WALL, findFurnitureSpot, footprintBounds, type Spot } from "./furniture";
import { openingLine } from "./walls";
import { EPS } from "../lib/geometry";

/** What a sensible first pass puts in each kind of room, in placement order. */
export const FURNISH_SETS: Partial<Record<RoomType, string[]>> = {
  living: ["sofa-3", "tv-unit", "coffee-table", "rug-large", "sofa-1", "floor-lamp", "plant-floor", "ceiling-fan"],
  family: ["sofa-2", "tv-unit", "coffee-round", "bean-bag", "ceiling-fan"],
  dining: ["dining-6", "crockery", "pendant"],
  kitchen: ["counter-8", "counter-4", "fridge-double", "kitchen-sink", "hob", "chimney", "wall-cabinet"],
  "master-bedroom": ["bed-king", "nightstand", "nightstand", "wardrobe-3", "dressing-table", "ac-split", "ceiling-fan"],
  bedroom: ["bed-queen", "nightstand", "nightstand", "wardrobe-2", "study-table", "ceiling-fan"],
  "guest-bedroom": ["bed-queen", "nightstand", "wardrobe-2", "ceiling-fan"],
  "kids-bedroom": ["bed-single", "kids-desk", "kids-storage", "wardrobe-2", "ceiling-fan"],
  servant: ["bed-single", "almirah"],
  bathroom: ["wc", "basin", "shower", "geyser"],
  "attached-bathroom": ["wc", "vanity", "shower", "geyser"],
  powder: ["wc", "basin"],
  study: ["desk", "office-chair", "bookshelf"],
  "home-office": ["desk-l", "office-chair", "bookshelf-wide"],
  pooja: ["mandir", "diya-stand"],
  foyer: ["shoe-rack", "console"],
  utility: ["washer-front", "counter-4", "storage-cabinet"],
  laundry: ["washer-front", "dryer"],
  store: ["store-rack", "store-rack"],
  gym: ["treadmill", "exercise-bike", "dumbbell-rack"],
  "home-theatre": ["projector-screen", "recliner", "recliner", "recliner", "projector"],
  garden: ["shade-tree", "garden-swing", "planter", "shrub"],
  courtyard: ["tulsi", "planter", "areca-palm"],
  terrace: ["water-tank", "solar", "planter"],
  balcony: ["patio-chair", "planter"],
  parking: ["car-sedan"],
  garage: ["car-suv", "store-rack"],
  porch: ["bench", "plant-floor"],
};

/** Sides of a room that a door passes through — counters and beds avoid these. */
export function doorSides(d: HomeDesign, room: Room): Side[] {
  const out = new Set<Side>();
  for (const o of d.doors) {
    const p = openingLine(d, o);
    if (!p || p.floor !== room.floor) continue;
    const sides: [Side, boolean, number, number, number][] = [
      ["north", true, room.y, room.x, room.x + room.width],
      ["south", true, room.y + room.length, room.x, room.x + room.width],
      ["west", false, room.x, room.y, room.y + room.length],
      ["east", false, room.x + room.width, room.y, room.y + room.length],
    ];
    for (const [side, horizontal, line, a, b] of sides)
      if (p.horizontal === horizontal && Math.abs(p.line - line) < EPS && p.end > a + EPS && p.start < b - EPS)
        out.add(side);
  }
  return [...out];
}
const ALL: Side[] = ["north", "east", "south", "west"];
const opposite = (s: Side): Side => ({ north: "south", south: "north", east: "west", west: "east" })[s] as Side;
/** Walls ordered by preference: no door first, then longest. */
export function preferredSides(d: HomeDesign, room: Room): Side[] {
  const doors = doorSides(d, room),
    len = (s: Side) => (s === "north" || s === "south" ? room.width : room.length);
  return [...ALL].sort((a, b) => Number(doors.includes(a)) - Number(doors.includes(b)) || len(b) - len(a));
}

export type FurnishResult = { design: HomeDesign; placed: string[]; skipped: string[] };
let counter = 0;
const nextId = (roomId: string) => `${roomId}-f${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Place one item; returns the new design or null. Never places anything invalid. */
export function placeItem(
  d: HomeDesign,
  room: Room,
  catalogId: string,
  spot: Spot | null,
  id = nextId(room.id),
): { design: HomeDesign; piece: PlacedFurniture } | null {
  if (!spot) return null;
  const piece = { id, catalogId, roomId: room.id, floor: room.floor, ...spot },
    r = applyAction(d, { type: "furniture/add", piece });
  return r.applied ? { design: r.design, piece } : null;
}
/** A dining table along the room's long axis, chairs all round facing it. */
export function placeDiningSet(d: HomeDesign, roomId: string, tableId = "dining-6", idPrefix = roomId, at?: { x: number; y: number; alongX?: boolean }): FurnishResult {
  const room = d.rooms.find((r) => r.id === roomId),
    table = itemFor(d, tableId),
    chair = itemFor(d, "dining-chair");
  if (!room || !table || !chair) return { design: d, placed: [], skipped: [tableId] };
  const alongX = at?.alongX ?? room.width >= room.length,
    cx = at?.x ?? room.x + room.width / 2,
    cy = at?.y ?? room.y + room.length / 2,
    rotation = alongX ? 0 : 90,
    placedTable = placeItem(d, room, tableId, { x: cx, y: cy, rotation }, `${idPrefix}-table`);
  if (!placedTable) return { design: d, placed: [], skipped: [tableId] };
  let design = placedTable.design;
  const placed = [tableId],
    skipped: string[] = [],
    perSide = Math.max(1, Math.floor(table.width / 2)),
    gap = 0.05,
    off = table.depth / 2 + chair.depth / 2 + gap,
    endOff = table.width / 2 + chair.depth / 2 + gap,
    seats: Spot[] = [];
  for (let i = 0; i < perSide; i++) {
    const t = -table.width / 2 + (table.width / perSide) * (i + 0.5);
    // Rotation 0 faces south: the chair on the north side faces the table.
    if (alongX) {
      seats.push({ x: cx + t, y: cy - off, rotation: 0 }, { x: cx + t, y: cy + off, rotation: 180 });
    } else {
      seats.push({ x: cx - off, y: cy + t, rotation: 270 }, { x: cx + off, y: cy + t, rotation: 90 });
    }
  }
  if (table.width >= 6)
    seats.push(
      ...(alongX
        ? [
            { x: cx - endOff, y: cy, rotation: 270 },
            { x: cx + endOff, y: cy, rotation: 90 },
          ]
        : [
            { x: cx, y: cy - endOff, rotation: 0 },
            { x: cx, y: cy + endOff, rotation: 180 },
          ]),
    );
  seats.forEach((s, i) => {
    const r = placeItem(design, room, "dining-chair", s, `${idPrefix}-chair${i}`);
    if (r) {
      design = r.design;
      placed.push("dining-chair");
    } else skipped.push("dining-chair");
  });
  return { design, placed, skipped };
}
/** Furnish a room with its standard set, or the given items, as well as it fits. */
export function furnishRoom(d: HomeDesign, roomId: string, items?: string[]): FurnishResult {
  const room = d.rooms.find((r) => r.id === roomId);
  if (!room) return { design: d, placed: [], skipped: items ?? [] };
  let design = d;
  const placed: string[] = [],
    skipped: string[] = [],
    sides = preferredSides(d, room),
    noDoor = sides.filter((s) => !doorSides(d, room).includes(s));
  let anchor: { piece: PlacedFurniture; side: Side } | null = null;
  // The standard set only fills what is missing: a room that has a bed keeps it, and
  // a bed already there anchors the nightstands. Explicit items are always added.
  const existing = d.furniture.filter((f) => f.roomId === roomId),
    have = new Map<string, number>();
  for (const f of existing) have.set(f.catalogId, (have.get(f.catalogId) ?? 0) + 1);
  const wanted = items ?? (FURNISH_SETS[room.type] ?? []).filter((id) => {
    const n = have.get(id) ?? 0;
    if (n > 0) have.set(id, n - 1);
    return n === 0;
  });
  if (!items)
    for (const f of existing) {
      const shape = itemFor(d, f.catalogId)?.shape;
      if (anchor || (shape !== "bed" && shape !== "sofa")) continue;
      const back = ALL.find((s) => ROTATION_FOR_WALL[s] === f.rotation);
      if (back) anchor = { piece: f, side: back };
    }
  // A room with a sofa or bed already does not get a second one from the standard set.
  const hasAnchor = !!anchor;
  for (const id of wanted) {
    if (!items && hasAnchor && ["bed", "sofa"].includes(itemFor(design, id)?.shape ?? "") && /^(bed-|sofa-3|sofa-2)/.test(id)) continue;
    const item = itemFor(design, id);
    if (!item) {
      skipped.push(id);
      continue;
    }
    if (id.startsWith("dining-") && item.category === "tables") {
      const r = placeDiningSet(design, roomId, id, `${roomId}-${placed.length}`);
      design = r.design;
      placed.push(...r.placed);
      skipped.push(...r.skipped);
      continue;
    }
    let spot: Spot | null = null;
    if (item.shape === "bed" || item.shape === "sofa" || item.shape === "counter") {
      // Beds, sofas and counters go on walls without doors where they can.
      spot = findFurnitureSpot(design, roomId, id, { sides: item.shape === "counter" && noDoor.length ? noDoor : sides });
    } else if (id === "nightstand" && anchor) {
      const b = footprintBounds(itemFor(design, anchor.piece.catalogId)!, anchor.piece),
        head = anchor.side,
        near =
          head === "north" || head === "south"
            ? { x: b.x - 1, y: head === "north" ? b.y : b.y + b.length }
            : { x: head === "west" ? b.x : b.x + b.width, y: b.y - 1 },
        far =
          head === "north" || head === "south"
            ? { x: b.x + b.width + 1, y: near.y }
            : { x: near.x, y: b.y + b.length + 1 };
      const taken = design.furniture.filter((f) => f.roomId === roomId && f.catalogId === "nightstand").length;
      spot = findFurnitureSpot(design, roomId, id, { sides: [head], near: taken ? far : near });
    } else if ((id === "tv-unit" || id === "projector-screen") && anchor) {
      spot = findFurnitureSpot(design, roomId, id, { sides: [opposite(anchor.side), ...sides] });
    } else if (id === "chimney") {
      const hob = design.furniture.find((f) => f.roomId === roomId && f.catalogId === "hob");
      spot = findFurnitureSpot(design, roomId, id, hob ? { near: { x: hob.x, y: hob.y } } : {});
    } else if (item.shape === "rug" || item.mount === "ceiling" || ["coffee-table", "coffee-round"].includes(id)) {
      spot = findFurnitureSpot(design, roomId, id, {
        freeStanding: true,
        near: { x: room.x + room.width / 2, y: room.y + room.length / 2 },
      });
    } else spot = findFurnitureSpot(design, roomId, id, { sides });
    const r = placeItem(design, room, id, spot);
    if (!r) {
      skipped.push(id);
      continue;
    }
    design = r.design;
    placed.push(id);
    if (!anchor && (item.shape === "bed" || item.shape === "sofa")) {
      const back = (["north", "east", "south", "west"] as Side[]).find((s) => ROTATION_FOR_WALL[s] === r.piece.rotation);
      if (back) anchor = { piece: r.piece, side: back };
    }
  }
  return { design, placed, skipped };
}
