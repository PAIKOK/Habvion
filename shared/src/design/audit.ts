import type { Door, HomeDesign, Opening, Rect, Room, RoomType } from "../types/home";
import { EPS, area, intersection } from "../lib/geometry";
import { ROOM_INFO, isOpenAir } from "./roomTypes";
import { openingLine } from "./walls";
import { arrivalsOf } from "./stairs";
import { itemFor } from "./catalog";
import { footprint, footprintBounds, layerOf } from "./furniture";
import { issue, type Issue } from "./actions";
import { validateDesign } from "./validation";

export type RoomRole = "circulation" | "shared" | "private" | "dependent" | "outdoor";
/** How the circulation walk treats each room type. */
export function roleOf(type: RoomType): RoomRole {
  if (["hall", "foyer", "staircase"].includes(type)) return "circulation";
  if (["garden", "parking", "porch", "courtyard", "terrace"].includes(type)) return "outdoor";
  if (
    [
      "attached-bathroom",
      "bathroom",
      "powder",
      "dressing",
      "walk-in-wardrobe",
      "balcony",
      "store",
      "pantry",
      "utility",
      "laundry",
    ].includes(type)
  )
    return "dependent";
  if (type.includes("bedroom") || ["servant", "study", "home-office", "pooja"].includes(type))
    return "private";
  return "shared";
}
const PRIVATE_ARRIVAL: RoomRole[] = ["private", "dependent"];
export const WET_ROOMS: RoomType[] = [
  "bathroom",
  "attached-bathroom",
  "powder",
  "kitchen",
  "laundry",
  "utility",
];

/** The room on the far side of a door, if any; null means the door leads outside. */
export function roomBeyond(d: HomeDesign, o: Opening): Room | null {
  const p = openingLine(d, o);
  if (!p) return null;
  const opposite = { north: "south", south: "north", east: "west", west: "east" } as const;
  return (
    d.rooms.find((r) => {
      if (r.id === o.roomId || r.floor !== p.floor) return false;
      const side = opposite[o.side],
        line =
          side === "north"
            ? r.y
            : side === "south"
              ? r.y + r.length
              : side === "west"
                ? r.x
                : r.x + r.width,
        start = p.horizontal ? r.x : r.y,
        end = start + (p.horizontal ? r.width : r.length);
      return Math.abs(line - p.line) < EPS && p.start >= start - EPS && p.end <= end + EPS;
    }) ?? null
  );
}
/** A window lets in air only if what lies beyond it is open sky, not another room. */
export function opensOutside(d: HomeDesign, o: Opening) {
  const beyond = roomBeyond(d, o);
  return !beyond || isOpenAir(beyond.type);
}
/**
 * A door leads outside if nothing is beyond it, or only open ground: a front door
 * that opens onto a porch, garden or parking is still the way in.
 */
export function leadsOutside(d: HomeDesign, o: Opening) {
  const beyond = roomBeyond(d, o);
  return !beyond || (beyond.floor === 0 && isOpenAir(beyond.type));
}
/** Length two open-air rooms on the same floor share along an edge. */
function sharedEdge(a: Room, b: Room) {
  const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    oy = Math.min(a.y + a.length, b.y + b.length) - Math.max(a.y, b.y);
  if (Math.abs(oy) < EPS && ox > EPS) return ox;
  if (Math.abs(ox) < EPS && oy > EPS) return oy;
  return 0;
}
/** The room on the stair's upper floor holding most of an arrival rect, and how much. */
export function arrivalRoom(d: HomeDesign, floor: number, a: Rect) {
  let best: Room | null = null,
    cover = 0;
  for (const r of d.rooms.filter((r) => r.floor === floor)) {
    const i = intersection(r, a),
      c = i ? area(i) / area(a) : 0;
    if (c > cover) [best, cover] = [r, c];
  }
  return { room: best, cover };
}

export type Reach = { reached: Set<string>; entries: string[] };
/**
 * Walk from the way in. The walk spreads through halls, foyers, staircases and outdoor
 * spaces, may pass through shared rooms, and stops at private rooms; dependent rooms
 * (bathrooms, balconies, stores) hang off whichever room they open from. It follows
 * doors, stairs, and open edges between open-air rooms.
 */
export function reachability(d: HomeDesign): Reach {
  const edges = new Map<string, Set<string>>(),
    link = (a: string, b: string) => {
      (edges.get(a) ?? edges.set(a, new Set()).get(a)!).add(b);
      (edges.get(b) ?? edges.set(b, new Set()).get(b)!).add(a);
    },
    entries = new Set<string>();
  for (const door of d.doors) {
    const owner = d.rooms.find((r) => r.id === door.roomId);
    if (!owner) continue;
    const beyond = roomBeyond(d, door);
    if (beyond) link(owner.id, beyond.id);
    else if (owner.floor === 0) entries.add(owner.id);
  }
  const open = d.rooms.filter((r) => isOpenAir(r.type));
  for (const a of open)
    for (const b of open)
      if (a.id < b.id && a.floor === b.floor && sharedEdge(a, b) >= 3 - EPS) link(a.id, b.id);
  for (const r of d.rooms)
    if (r.floor === 0 && ["garden", "parking", "porch"].includes(r.type)) entries.add(r.id);
  for (const s of d.stairs) {
    const from = d.rooms.find(
      (r) =>
        r.floor === s.fromFloor && intersection(r, s) && area(intersection(r, s)!) >= area(s) - EPS,
    );
    if (!from) continue;
    for (const a of arrivalsOf(d, s)) {
      const { room } = arrivalRoom(d, s.toFloor, a);
      if (room) link(from.id, room.id);
    }
  }
  const role = new Map(d.rooms.map((r) => [r.id, roleOf(r.type)])),
    reached = new Set<string>(entries),
    queue = [...entries];
  while (queue.length) {
    const id = queue.shift()!,
      from = role.get(id)!;
    for (const next of edges.get(id) ?? []) {
      if (reached.has(next)) continue;
      const to = role.get(next)!;
      const spreads = from === "circulation" || from === "shared" || from === "outdoor";
      if (spreads || to === "dependent") {
        reached.add(next);
        // Private and dependent rooms are dead ends, except into further dependents.
        queue.push(next);
      }
    }
  }
  return { reached, entries: [...entries] };
}

export function auditDesign(d: HomeDesign): Issue[] {
  const issues: Issue[] = [],
    at = (i: Issue, floor?: number) => issues.push({ ...i, floor });
  const enclosedGround = d.rooms.filter((r) => r.floor === 0 && !isOpenAir(r.type));
  const { reached, entries } = reachability(d);
  if (
    enclosedGround.length &&
    !d.doors.some((o) => enclosedGround.some((r) => r.id === o.roomId) && leadsOutside(d, o))
  )
    at(issue("access/no-entrance", "The house has no door to the outside."), 0);
  for (const r of d.rooms)
    if (!reached.has(r.id) && !(isOpenAir(r.type) && r.floor === 0))
      at(
        issue(
          "room/no-hall-access",
          entries.length
            ? `${r.name} cannot be reached from the entrance through halls or shared rooms.`
            : `${r.name} cannot be reached: there is no way in yet.`,
          [r.id],
        ),
        r.floor,
      );
  for (const s of d.stairs)
    for (const a of arrivalsOf(d, s)) {
      const { room, cover } = arrivalRoom(d, s.toFloor, a);
      if (!room || cover < 0.95)
        at(
          issue(
            "stair/arrives-at-wall",
            room
              ? `The stair arrives against a wall: only ${Math.round(cover * 100)}% of its landing is inside ${room.name}.`
              : "The stair arrives where there is no floor.",
            [s.id],
          ),
          s.toFloor,
        );
      else if (PRIVATE_ARRIVAL.includes(roleOf(room.type)))
        at(
          issue(
            "stair/arrives-in-private-room",
            `The stair arrives inside ${room.name}, a private room.`,
            [s.id, room.id],
          ),
          s.toFloor,
        );
    }
  for (const r of d.rooms) {
    const outside = d.windows.some((o) => o.roomId === r.id && opensOutside(d, o));
    if (WET_ROOMS.includes(r.type) && !outside)
      at(
        issue("room/wet-no-window", `${r.name} needs a window to the outside for ventilation.`, [
          r.id,
        ]),
        r.floor,
      );
    else if (
      ["private", "shared"].includes(roleOf(r.type)) &&
      !outside &&
      r.type !== "home-theatre" &&
      r.type !== "pooja"
    )
      at(
        issue("room/no-daylight", `${r.name} has no window to the outside.`, [r.id], "warning"),
        r.floor,
      );
    const info = ROOM_INFO[r.type];
    if (!isOpenAir(r.type) && area(r) < info.width * info.length * 0.8)
      at(
        issue(
          "room/below-recommended",
          `${r.name} is ${Math.round(area(r))} sq ft; ${Math.round(info.width * info.length)} is comfortable.`,
          [r.id],
          "warning",
        ),
        r.floor,
      );
  }
  const bedrooms = d.rooms.filter((r) => r.type.includes("bedroom")),
    baths = d.rooms.filter((r) => ["bathroom", "attached-bathroom"].includes(r.type));
  if (bedrooms.length && !d.rooms.some((r) => r.type === "kitchen"))
    at(issue("services/no-kitchen", "A home with bedrooms needs a kitchen."));
  if (bedrooms.length && !baths.length)
    at(issue("services/no-bathroom", "A home with bedrooms needs a bathroom."));
  if (bedrooms.length > 2 * baths.length && baths.length)
    at(
      issue(
        "services/bath-ratio",
        `${bedrooms.length} bedrooms share ${baths.length} bathroom(s).`,
        undefined,
        "warning",
      ),
    );
  const parking = d.rooms
      .filter((r) => r.type === "parking" || r.type === "garage")
      .reduce((n, r) => n + area(r), 0),
    need = d.parkingNeed === "2-car" ? 260 : d.parkingNeed === "1-car" ? 130 : 0;
  if (need && parking < need)
    at(
      issue(
        "services/parking",
        `Parking for ${d.parkingNeed === "2-car" ? "two cars" : "one car"} needs ${need} sq ft; there is ${Math.round(parking)}.`,
      ),
    );
  for (const k of d.rooms.filter((r) => r.type === "kitchen"))
    if (!d.furniture.some((f) => f.roomId === k.id && itemFor(d, f.catalogId)?.shape === "counter"))
      at(
        issue("services/kitchen-counter", `${k.name} has no counter yet.`, [k.id], "warning"),
        k.floor,
      );
  const entrances = d.doors.filter(
    (o) => enclosedGround.some((r) => r.id === o.roomId) && leadsOutside(d, o),
  );
  if (entrances.length && !entrances.some((o) => o.width >= 3 - EPS))
    at(
      issue(
        "access/narrow-entrance",
        "Make at least one entrance 3 ft wide for wheelchairs and furniture.",
        entrances.map((o) => o.id),
        "warning",
      ),
      0,
    );
  if (
    d.floors.length > 1 &&
    d.rooms.some((r) => r.floor === 0 && r.type.includes("bedroom")) &&
    !d.rooms.some((r) => r.floor === 0 && WET_ROOMS.slice(0, 3).includes(r.type))
  )
    at(
      issue(
        "access/no-ground-bath",
        "Ground-floor bedrooms have no ground-floor bathroom.",
        undefined,
        "warning",
      ),
      0,
    );
  for (const door of d.doors.filter((o: Door) => o.width < 2.67 - EPS)) {
    const r = d.rooms.find((x) => x.id === door.roomId);
    if (r && r.type.includes("bedroom"))
      at(
        issue("access/narrow-door", `${r.name}'s door is under 2'8".`, [door.id], "warning"),
        r.floor,
      );
  }
  issues.push(...crampedIssues(d));
  return issues;
}
/** Seats belong in front of tables and desks; they never make them cramped. */
const SEATS = ["chair", "armchair"];
// Counters meet at corners to make L and U kitchens; one never cramps another.
/**
 * Furniture that needs clear floor in front of it (a wardrobe's doors, a bed's foot,
 * a counter's working space) but has a wall, the room's edge or a tall piece there.
 */
export function crampedIssues(d: HomeDesign, only?: (p: HomeDesign["furniture"][number]) => boolean): Issue[] {
  const issues: Issue[] = [];
  for (const p of d.furniture) {
    if (only && !only(p)) continue;
    const item = itemFor(d, p.catalogId);
    if (!item?.clearanceFt || layerOf(item) !== "floor") continue;
    const a = (p.rotation * Math.PI) / 180,
      front = { x: -Math.sin(a), y: Math.cos(a) },
      reach = item.depth / 2 + item.clearanceFt / 2,
      zoneItem = { ...item, depth: item.clearanceFt, width: Math.max(1, item.width - 0.5) },
      at = { x: p.x + front.x * reach, y: p.y + front.y * reach, rotation: p.rotation },
      zone = footprint(zoneItem, at),
      zb = footprintBounds(zoneItem, at),
      room = d.rooms.find((r) => r.id === p.roomId);
    if (!room) continue;
    const inside =
        zb.x >= room.x - 0.25 &&
        zb.y >= room.y - 0.25 &&
        zb.x + zb.width <= room.x + room.width + 0.25 &&
        zb.y + zb.length <= room.y + room.length + 0.25,
      seating = ["table", "desk"].includes(item.shape),
      blocker = d.furniture.find((o) => {
        if (o.id === p.id || o.floor !== p.floor) return false;
        const oi = itemFor(d, o.catalogId);
        if (!oi || layerOf(oi) !== "floor" || oi.height < 1.6) return false;
        if (seating && SEATS.includes(oi.shape)) return false;
        if (item.shape === "counter" && oi.shape === "counter") return false;
        return polygonsTouch(zone, footprint(oi, o));
      });
    if (!inside || blocker)
      issues.push({
        ...issue(
          "furniture/cramped",
          `${item.name} needs ${item.clearanceFt} ft clear in front${blocker ? `; ${itemFor(d, blocker.catalogId)!.name} is in the way` : ""}.`,
          [p.id],
          "warning",
        ),
        floor: p.floor,
      });
  }
  return issues;
}
function polygonsTouch(a: { x: number; y: number }[], b: { x: number; y: number }[]) {
  const bounds = (p: { x: number; y: number }[]) => ({
      x0: Math.min(...p.map((q) => q.x)),
      x1: Math.max(...p.map((q) => q.x)),
      y0: Math.min(...p.map((q) => q.y)),
      y1: Math.max(...p.map((q) => q.y)),
    }),
    A = bounds(a),
    B = bounds(b);
  return A.x0 < B.x1 - 0.05 && B.x0 < A.x1 - 0.05 && A.y0 < B.y1 - 0.05 && B.y0 < A.y1 - 0.05;
}
/** Everything the issues panel shows: validation warnings plus the audit, errors first. */
export function allIssues(d: HomeDesign): Issue[] {
  const floorOf = (i: Issue) =>
    i.floor ??
    (i.entityIds ?? [])
      .map(
        (id) =>
          d.rooms.find((r) => r.id === id)?.floor ??
          d.furniture.find((f) => f.id === id)?.floor ??
          d.stairs.find((s) => s.id === id)?.fromFloor,
      )
      .find((f) => f !== undefined);
  const all = [...validateDesign(d).issues, ...auditDesign(d)].map((i) => ({
    ...i,
    floor: floorOf(i),
  }));
  return [...all.filter((i) => i.level === "error"), ...all.filter((i) => i.level !== "error")];
}
