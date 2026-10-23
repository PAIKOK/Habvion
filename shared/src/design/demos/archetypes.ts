import type { PlacedFurniture, Side } from "../../types/home";
import { itemFor } from "../catalog";
import { ROTATION_FOR_WALL, alongWall, footprintBounds, type Spot } from "../furniture";
import { doorSides, placeDiningSet } from "../furnish";
import { isOpenAir } from "../roomTypes";
import { HouseBuilder, opposite } from "./builder";

const ALL: Side[] = ["north", "east", "south", "west"];
const len = (b: HouseBuilder, roomId: string, s: Side) => {
  const r = b.room(roomId);
  return s === "north" || s === "south" ? r.width : r.length;
};
/** Walls without a door first, longest first. */
export function wallsByPreference(b: HouseBuilder, roomId: string, avoid: Side[] = []) {
  const doors = doorSides(b.d, b.room(roomId));
  return [...ALL]
    .filter((s) => !avoid.includes(s))
    .sort((a, c) => Number(doors.includes(a)) - Number(doors.includes(c)) || len(b, roomId, c) - len(b, roomId, a));
}
export const doorless = (b: HouseBuilder, roomId: string) => {
  const doors = doorSides(b.d, b.room(roomId));
  return wallsByPreference(b, roomId).filter((s) => !doors.includes(s));
};
/** Spots along a wall; "ends" tries the corners first, "middle" the centre first. */
export function wallSpots(b: HouseBuilder, roomId: string, catalogId: string, side: Side, order: "middle" | "ends" = "middle", rotation = 0): Spot[] {
  const item = itemFor(b.d, catalogId)!,
    spots = alongWall(b.room(roomId), item, side, 0.25).map((s) => ({ ...s, rotation: (s.rotation + rotation) % 360 }));
  return order === "middle" ? spots : [...spots].reverse();
}
const backOf = (p: PlacedFurniture): Side => ALL.find((s) => ROTATION_FOR_WALL[s] === p.rotation % 360) ?? "north";
const front = (rotation: number) => {
  const a = (rotation * Math.PI) / 180;
  return { x: -Math.sin(a), y: Math.cos(a) };
};
/** Place on the first wall (in order) where any spot works. */
function onWalls(b: HouseBuilder, roomId: string, ids: string[], walls: Side[], order: "middle" | "ends" = "middle") {
  for (const id of ids) for (const w of walls) {
    const p = b.tryFirst(roomId, id, wallSpots(b, roomId, id, w, order));
    if (p) return p;
  }
  return null;
}
/** Items standing on a worktop: slide along the counter's length. */
/**
 * Something on a counter, scanned from one end. With `partner`, a spot only counts if
 * the partner fits too (a hob needs room for its chimney); otherwise it is undone.
 */
function onCounter(b: HouseBuilder, roomId: string, catalogId: string, counters: PlacedFurniture[], from: "start" | "end" = "start", partner?: (p: PlacedFurniture) => PlacedFurniture | null) {
  const item = itemFor(b.d, catalogId)!;
  for (const c of counters) {
    const ci = itemFor(b.d, c.catalogId)!,
      f = front(c.rotation),
      along = { x: f.y, y: -f.x },
      spots: Spot[] = [];
    for (let t = -ci.width / 2 + item.width / 2; t <= ci.width / 2 - item.width / 2 + 1e-9; t += 0.25)
      spots.push({ x: c.x + along.x * t, y: c.y + along.y * t, rotation: c.rotation });
    if (!partner) {
      const p = b.tryFirst(roomId, catalogId, from === "start" ? spots : spots.reverse());
      if (p) return p;
      continue;
    }
    for (const s of from === "start" ? spots : spots.reverse()) {
      const before = b.d,
        p = b.tryFirst(roomId, catalogId, [s]);
      if (!p) continue;
      if (partner(p)) return p;
      b.d = before;
    }
  }
  return null;
}
function light(b: HouseBuilder, roomId: string, ids = ["ceiling-light"]) {
  const r = b.room(roomId);
  for (const id of ids) {
    const p = b.tryFirst(roomId, id, [
      { x: r.x + r.width / 2, y: r.y + r.length / 2, rotation: 0 },
      { x: r.x + r.width / 2, y: r.y + r.length * 0.3, rotation: 0 },
      { x: r.x + r.width / 2, y: r.y + r.length * 0.7, rotation: 0 },
      { x: r.x + r.width * 0.3, y: r.y + r.length / 2, rotation: 0 },
    ]);
    if (p) return p;
  }
  return null;
}

export function furnishBedroom(b: HouseBuilder, roomId: string, o: { bed?: string; wardrobe?: string; desk?: boolean; sideTables?: boolean; ac?: boolean; walkIn?: boolean } = {}) {
  const beds = [o.bed ?? "bed-queen", "bed-queen", "bed-double", "bed-single"],
    walls = wallsByPreference(b, roomId);
  let bed: PlacedFurniture | null = null;
  for (const id of beds) {
    bed = onWalls(b, roomId, [id], walls);
    if (bed) break;
  }
  if (!bed) b.refusals.push(`no bed fits in ${roomId}`);
  const head = bed ? backOf(bed) : walls[0]!;
  if (bed && o.sideTables !== false) {
    const bb = b.boundsOf(bed),
      ns = itemFor(b.d, "nightstand")!,
      g = 0.15,
      pts: Spot[] =
        head === "north" || head === "south"
          ? [bb.x - ns.width / 2 - g, bb.x + bb.width + ns.width / 2 + g].map((x) => ({ x, y: head === "north" ? bb.y + ns.depth / 2 + 0.01 : bb.y + bb.length - ns.depth / 2 - 0.01, rotation: bed!.rotation }))
          : [bb.y - ns.width / 2 - g, bb.y + bb.length + ns.width / 2 + g].map((y) => ({ x: head === "west" ? bb.x + ns.depth / 2 + 0.01 : bb.x + bb.width - ns.depth / 2 - 0.01, y, rotation: bed!.rotation }));
    for (const s of pts) {
      const p = b.tryFirst(roomId, "nightstand", [s]);
      if (p) b.tryFirst(roomId, "table-lamp", [{ x: p.x, y: p.y, rotation: p.rotation }]);
    }
  }
  // Storage on a side wall at the foot end clears the bed's foot; the opposite wall is next.
  const r = b.room(roomId),
    headLine = { north: r.y, south: r.y + r.length, west: r.x, east: r.x + r.width }[head],
    farFromHead = (s: Spot) => -(head === "north" || head === "south" ? Math.abs(s.y - headLine) : Math.abs(s.x - headLine));
  let storage: PlacedFurniture | null = null;
  // With a walk-in wardrobe next door the bedroom only takes a chest of drawers, if it fits.
  for (const id of o.walkIn ? ["chest-drawers"] : [o.wardrobe ?? "wardrobe-2", "wardrobe-2", "almirah", "chest-drawers"]) {
    const sideSpots = ALL.filter((w) => w !== head && w !== opposite[head]).flatMap((w) => wallSpots(b, roomId, id, w)).sort((a, c) => farFromHead(a) - farFromHead(c));
    storage = b.tryFirst(roomId, id, [...sideSpots, ...wallSpots(b, roomId, id, opposite[head], "ends")]);
    if (storage) break;
  }
  if (!storage && !o.walkIn) b.refusals.push(`no storage fits in ${roomId}`);
  if (o.desk) {
    const desk = onWalls(b, roomId, ["study-table", "kids-desk"], walls.filter((w) => w !== head), "ends");
    if (desk) chairAt(b, roomId, desk, "office-chair");
  }
  if (o.ac !== false) onWalls(b, roomId, ["ac-split"], [head, ...walls]);
  light(b, roomId, ["ceiling-fan"]);
  light(b, roomId, ["ceiling-light", "pendant"]);
  b.trySomewhere(roomId, "plant-floor");
  return bed;
}
/** A chair facing a desk or table, just in front of it. */
export function chairAt(b: HouseBuilder, roomId: string, desk: PlacedFurniture, chairId: string) {
  const di = itemFor(b.d, desk.catalogId)!,
    ci = itemFor(b.d, chairId)!,
    f = front(desk.rotation),
    reach = di.depth / 2 + ci.depth / 2 + 0.05;
  return b.tryFirst(roomId, chairId, [{ x: desk.x + f.x * reach, y: desk.y + f.y * reach, rotation: (desk.rotation + 180) % 360 }]);
}

export function furnishBathroom(b: HouseBuilder, roomId: string, o: { shower?: string; basin?: string; tub?: boolean } = {}) {
  const free = doorless(b, roomId),
    walls = [...free, ...wallsByPreference(b, roomId).filter((w) => !free.includes(w))];
  const enclosure = o.tub ? onWalls(b, roomId, ["bathtub"], walls, "ends") : null;
  const shower = enclosure ?? onWalls(b, roomId, [o.shower ?? "shower", "shower"], walls, "ends");
  const wc = onWalls(b, roomId, ["wc", "wc-wall", "indian-wc"], walls, "ends");
  const basin = onWalls(b, roomId, [o.basin ?? "basin", "basin"], walls, "middle");
  if (!wc) b.refusals.push(`no WC fits in ${roomId}`);
  if (!basin) b.refusals.push(`no basin fits in ${roomId}`);
  if (!shower) b.skipped.push(`no shower in ${roomId}`);
  if (basin) b.tryFirst(roomId, "bath-mirror", [{ x: basin.x, y: basin.y, rotation: basin.rotation }]);
  onWalls(b, roomId, ["geyser"], walls);
  onWalls(b, roomId, ["towel-rail"], walls);
  light(b, roomId, ["ceiling-light"]);
}

export function furnishKitchen(b: HouseBuilder, roomId: string, o: { island?: boolean } = {}) {
  const free = doorless(b, roomId),
    walls = wallsByPreference(b, roomId),
    counters: PlacedFurniture[] = [];
  const main = onWalls(b, roomId, ["counter-8", "counter-6", "counter-4"], free.length ? free : walls, "ends");
  if (main) {
    counters.push(main);
    const side = backOf(main);
    // A return on an adjacent wall without a door.
    const adj = free.filter((w) => w !== side && w !== opposite[side]);
    const near = (sp: Spot) => Math.hypot(sp.x - main.x, sp.y - main.y);
    let ret: PlacedFurniture | null = null;
    for (const id of ["counter-6", "counter-4"]) {
      ret = b.tryFirst(roomId, id, (adj.length ? adj : walls.filter((w) => w !== side)).flatMap((w) => wallSpots(b, roomId, id, w)).sort((a, c) => near(a) - near(c)));
      if (ret) break;
    }
    if (ret) counters.push(ret);
  } else b.refusals.push(`no counter fits in ${roomId}`);
  if (o.island) {
    const r = b.room(roomId);
    const isl = b.tryFirst(roomId, "island", [{ x: r.x + r.width / 2, y: r.y + r.length / 2, rotation: r.width >= r.length ? 0 : 90 }]);
    if (isl) counters.push(isl);
  }
  const sink = onCounter(b, roomId, "kitchen-sink", counters, "start");
  const hob =
    onCounter(b, roomId, "hob", [...counters].reverse(), "end", (p) => b.tryFirst(roomId, "chimney", [{ x: p.x, y: p.y, rotation: p.rotation }])) ??
    onCounter(b, roomId, "hob", [...counters].reverse(), "end");
  for (const id of ["microwave", "mixer", "fruit-bowl", "otg"]) onCounter(b, roomId, id, counters);
  const fridge = onWalls(b, roomId, ["fridge-double", "fridge-single"], walls, "ends");
  if (!sink || !hob || !fridge) b.refusals.push(`kitchen ${roomId} missing ${[!sink && "sink", !hob && "hob", !fridge && "fridge"].filter(Boolean).join(", ")}`);
  onWalls(b, roomId, ["water-purifier"], walls);
  onWalls(b, roomId, ["tall-unit"], walls, "ends");
  light(b, roomId, ["ceiling-light"]);
}

export function furnishLiving(b: HouseBuilder, roomId: string, o: { sofa?: string; tv?: boolean } = {}) {
  const walls = wallsByPreference(b, roomId);
  const sofa = onWalls(b, roomId, [o.sofa ?? "sofa-3", "sofa-3", "sofa-2"], walls);
  if (!sofa) return b.refusals.push(`no sofa fits in ${roomId}`);
  const back = backOf(sofa),
    faceWall = opposite[back];
  const unit = o.tv === false ? null : b.tryFirst(roomId, "tv-unit", wallSpots(b, roomId, "tv-unit", faceWall).sort((a, c) => Math.hypot(a.x - sofa.x, a.y - sofa.y) - Math.hypot(c.x - sofa.x, c.y - sofa.y)));
  if (unit) b.tryFirst(roomId, "tv-55", [{ x: unit.x, y: unit.y, rotation: unit.rotation }]);
  // The coffee table sits in the gap between them.
  const target = unit ?? { x: sofa.x + front(sofa.rotation).x * 6, y: sofa.y + front(sofa.rotation).y * 6 },
    f = front(sofa.rotation),
    si = itemFor(b.d, sofa.catalogId)!,
    gapMid = { x: (sofa.x + f.x * (si.depth / 2) + target.x) / 2, y: (sofa.y + f.y * (si.depth / 2) + target.y) / 2 };
  b.tryFirst(roomId, "rug-large", [{ x: gapMid.x, y: gapMid.y, rotation: sofa.rotation }]) ?? b.tryFirst(roomId, "rug-medium", [{ x: gapMid.x, y: gapMid.y, rotation: sofa.rotation }]);
  b.tryFirst(roomId, "coffee-table", [{ x: gapMid.x, y: gapMid.y, rotation: sofa.rotation }, { x: (gapMid.x + sofa.x) / 2 + f.x, y: (gapMid.y + sofa.y) / 2 + f.y, rotation: sofa.rotation }]) ??
    b.tryFirst(roomId, "coffee-round", [{ x: gapMid.x, y: gapMid.y, rotation: 0 }]);
  // An armchair on a side wall, turned to the room.
  const sides = walls.filter((w) => w !== back && w !== faceWall);
  for (const w of sides) if (b.tryFirst(roomId, "sofa-1", wallSpots(b, roomId, "sofa-1", w))) break;
  // A floor lamp at one end of the sofa.
  const along = { x: f.y, y: -f.x },
    end = si.width / 2 + 0.8;
  b.tryFirst(roomId, "floor-lamp", [1, -1].map((k) => ({ x: sofa.x + along.x * end * k, y: sofa.y + along.y * end * k, rotation: sofa.rotation })));
  b.trySomewhere(roomId, "plant-floor");
  light(b, roomId, ["ceiling-fan"]);
  light(b, roomId, ["chandelier", "pendant", "ceiling-light"]);
  onWalls(b, roomId, ["wall-art-large", "wall-art"], [back]);
  return sofa;
}

export function furnishDining(b: HouseBuilder, roomId: string, at?: { x: number; y: number; alongX?: boolean; span?: number }) {
  const r = b.room(roomId),
    long = at?.span ?? Math.max(r.width, r.length),
    tables = long >= 12 ? ["dining-8", "dining-6", "dining-4"] : long >= 10 ? ["dining-6", "dining-4"] : ["dining-4"];
  for (const t of tables) {
    const res = placeDiningSet(b.d, roomId, t, b.id(`${roomId}-set`), at);
    if (res.placed.length && !res.skipped.includes("dining-chair")) {
      b.d = res.design;
      break;
    }
  }
  if (!b.d.furniture.some((f) => f.roomId === roomId && f.catalogId.startsWith("dining-") && f.catalogId !== "dining-chair")) b.refusals.push(`no dining set fits in ${roomId}`);
  onWalls(b, roomId, ["crockery", "sideboard"], wallsByPreference(b, roomId), "ends");
  light(b, roomId, ["chandelier", "pendant"]);
}

export function furnishStudy(b: HouseBuilder, roomId: string) {
  const walls = wallsByPreference(b, roomId);
  const desk = onWalls(b, roomId, ["desk", "study-table"], walls);
  if (desk) {
    chairAt(b, roomId, desk, "office-chair");
    b.tryFirst(roomId, "laptop", [{ x: desk.x, y: desk.y, rotation: desk.rotation }]);
    b.tryFirst(roomId, "table-lamp", [{ x: desk.x + 1.2 * front(desk.rotation).y, y: desk.y - 1.2 * front(desk.rotation).x, rotation: desk.rotation }]);
  } else b.refusals.push(`no desk fits in ${roomId}`);
  onWalls(b, roomId, ["bookshelf", "bookshelf-wide"], walls.filter((w) => !desk || w !== backOf(desk)), "ends");
  b.trySomewhere(roomId, "accent-chair");
  light(b, roomId, ["ceiling-fan"]);
  light(b, roomId, ["ceiling-light"]);
}

/** Trees, shrubs, a path light: outdoor rooms dressed from their size. */
export function landscape(b: HouseBuilder, roomId: string, items = ["shade-tree", "shrub", "shrub", "planter", "garden-lamp", "garden-lamp"]) {
  for (const id of items) b.trySomewhere(roomId, id, { freeStanding: true });
}

/** A light fitting in every room that has none: a pair in long rooms, sconces as the fallback. */
export function lightRooms(b: HouseBuilder) {
  for (const r of b.d.rooms) {
    const lit = () => b.d.furniture.some((f) => f.roomId === r.id && itemFor(b.d, f.catalogId)?.category === "lighting");
    if (isOpenAir(r.type) && r.floor === 0) {
      if (!lit()) landscape(b, r.id, ["garden-lamp"]);
      if (!lit()) onWalls(b, r.id, ["sconce"], ALL);
      continue;
    }
    if (isOpenAir(r.type)) {
      if (!lit()) onWalls(b, r.id, ["sconce"], ALL);
      if (!lit()) landscape(b, r.id, ["garden-lamp"]);
      continue;
    }
    const long = Math.max(r.width, r.length) >= 2 * Math.min(r.width, r.length) && Math.max(r.width, r.length) >= 12;
    if (long && !lit()) {
      const along = r.width >= r.length;
      b.tryFirst(r.id, "ceiling-light", [{ x: r.x + r.width * (along ? 0.25 : 0.5), y: r.y + r.length * (along ? 0.5 : 0.25), rotation: 0 }]);
      b.tryFirst(r.id, "ceiling-light", [{ x: r.x + r.width * (along ? 0.75 : 0.5), y: r.y + r.length * (along ? 0.5 : 0.75), rotation: 0 }]);
    }
    if (!lit()) light(b, r.id, ["ceiling-light", "pendant"]);
    if (!lit()) onWalls(b, r.id, ["sconce"], ALL);
  }
}
export { footprintBounds };
