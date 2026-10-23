import type {
  DoorType,
  FlooringType,
  HomeDesign,
  PlacedFurniture,
  Roof,
  Room,
  RoomType,
  Side,
  StairType,
  WindowType,
} from "../../types/home";
import type { DesignAction } from "../actions";
import { applyAction } from "../reducer";
import { createDesign, type NewDesignInput } from "../createDesign";
import { itemFor } from "../catalog";
import { crampedIssues } from "../audit";
import { ROTATION_FOR_WALL, alongWall, findFurnitureSpot, footprintBounds, validateFurniture, type Spot } from "../furniture";

export type BuildResult = { design: HomeDesign; refusals: string[]; skipped: string[] };
const opposite = { north: "south", south: "north", east: "west", west: "east" } as const;

/**
 * A fluent way to build a house through the same validated actions a person uses.
 * Required steps record a refusal when the rules say no; `try*` steps record a skip.
 * Nothing here bypasses validation: a demo is only as valid as its actions.
 */
export class HouseBuilder {
  d: HomeDesign;
  readonly refusals: string[] = [];
  readonly skipped: string[] = [];
  #seq = 0;
  constructor(input: NewDesignInput & { id: string; name: string }) {
    this.d = createDesign({ now: "2026-01-01T00:00:00.000Z", ...input });
  }
  /** Apply one action; returns whether it took. */
  act(a: DesignAction, label: string, optional = false) {
    const r = applyAction(this.d, a);
    if (r.applied) this.d = r.design;
    else (optional ? this.skipped : this.refusals).push(`${label}: ${r.issues.filter((i) => i.level === "error").map((i) => i.message).join("; ")}`);
    return r.applied;
  }
  id(prefix: string) {
    return `${prefix}-${(++this.#seq).toString(36)}`;
  }
  room(id: string) {
    const r = this.d.rooms.find((x) => x.id === id);
    if (!r) throw new Error(`HouseBuilder: unknown room ${id}`);
    return r;
  }

  setbacks(front: number, rear: number, left: number, right: number) {
    this.act({ type: "plot/update", patch: { setbacks: { front, rear, left, right } } }, "setbacks");
    return this;
  }
  /** A compound wall with a vehicle gate (and optionally a pedestrian gate) on the road side. */
  walled(gate: { side?: Side; offset: number; width: number; kind?: "sliding" | "swing" }, pedestrian?: { side?: Side; offset: number; width?: number }) {
    const side = gate.side ?? this.d.plot.roadSide;
    this.act(
      {
        type: "compound/set",
        compound: {
          height: 5,
          thickness: 0.75,
          gate: { side, offset: gate.offset, width: gate.width, kind: gate.kind ?? "sliding" },
          ...(pedestrian ? { pedestrianGate: { side: pedestrian.side ?? side, offset: pedestrian.offset, width: pedestrian.width ?? 3.5, kind: "pedestrian" as const } } : {}),
        },
      },
      "compound",
    );
    return this;
  }
  roof(type: Roof["type"], materialId: string, pitchDeg = 25, overhangFt = 1.5) {
    this.act({ type: "roof/set", roof: { type, materialId, pitchDeg, overhangFt } }, "roof");
    return this;
  }
  systems(smartHome: boolean, security: boolean) {
    this.act({ type: "systems/set", patch: { smartHome, security } }, "systems");
    return this;
  }
  addRoom(id: string, name: string, type: RoomType, x: number, y: number, width: number, length: number, floor = 0) {
    this.act({ type: "room/add", room: { id, name, type, x, y, width, length, floor } }, `room ${id}`);
    return this;
  }
  /** `offset` is the opening's centre, measured from the side's start (west or north end). */
  door(roomId: string, side: Side, offset: number, width = 3, doorType: DoorType = "panel", swing: "left" | "right" = "left") {
    this.act({ type: "door/add", door: { id: this.id(`${roomId}-d`), roomId, side, offset, width, height: 7, doorType, swing } }, `door ${roomId} ${side}@${offset}`);
    return this;
  }
  window(roomId: string, side: Side, offset: number, width = 4, windowType: WindowType = "casement", height = 4, sill = 3) {
    this.act({ type: "window/add", window: { id: this.id(`${roomId}-w`), roomId, side, offset, width, height, windowType, sill } }, `window ${roomId} ${side}@${offset}`);
    return this;
  }
  stair(id: string, x: number, y: number, width: number, length: number, fromFloor: number, direction: Side, stairType: StairType, turn: "left" | "right" = "left") {
    this.act({ type: "stair/add", stair: { id, x, y, width, length, fromFloor, toFloor: fromFloor + 1, direction, stairType, turn } }, `stair ${id}`);
    return this;
  }
  paint(roomId: string, colorHex: string) {
    this.act({ type: "paint/set", target: { kind: "room", roomId }, colorHex }, `paint ${roomId}`);
    return this;
  }
  paintWall(roomId: string, side: Side, colorHex: string) {
    this.act({ type: "paint/set", target: { kind: "wall", roomId, side }, colorHex }, `paint ${roomId} ${side}`);
    return this;
  }
  flooring(roomId: string, flooring: FlooringType) {
    this.act({ type: "flooring/set", roomId, flooring }, `flooring ${roomId}`);
    return this;
  }

  /** Place a piece at an absolute centre. */
  put(roomId: string, catalogId: string, x: number, y: number, rotation = 0, optional = false): PlacedFurniture | null {
    const room = this.room(roomId),
      piece = { id: this.id(`${roomId}-${catalogId}`), catalogId, roomId, floor: room.floor, x, y, rotation: ((rotation % 360) + 360) % 360 };
    // Most trial spots fail; checking the one piece first spares re-validating the
    // whole house for each of them. The action below still validates everything.
    const pre = validateFurniture({ ...this.d, furniture: [...this.d.furniture, piece] }, piece);
    if (!pre.ok) {
      (optional ? this.skipped : this.refusals).push(`${catalogId} in ${roomId}: ${pre.issues.filter((i) => i.level === "error").map((i) => i.message).join("; ")}`);
      return null;
    }
    return this.act({ type: "furniture/add", piece }, `${catalogId} in ${roomId}`, optional) ? piece : null;
  }
  /** Place at fractions of the room (0..1 across, 0..1 down). */
  within(roomId: string, catalogId: string, fx: number, fy: number, rotation = 0, optional = false) {
    const r = this.room(roomId);
    return this.put(roomId, catalogId, r.x + r.width * fx, r.y + r.length * fy, rotation, optional);
  }
  /**
   * Back a piece onto a wall. `along` is the centre's distance from the wall's start
   * (west or north end); null centres it. Extra rotation turns it in place, e.g. 180 for
   * a seat that faces the wall's piece.
   */
  spotAgainst(roomId: string, wall: Side, along: number | null, catalogId: string, opts: { gap?: number; rotation?: number } = {}): Spot | null {
    const r = this.room(roomId),
      item = itemFor(this.d, catalogId);
    if (!item) return null;
    const rotation = (ROTATION_FOR_WALL[wall] + (opts.rotation ?? 0)) % 360,
      square = rotation % 180 === 0,
      // The footprint's extent in x and y once rotated.
      ex = square ? item.width : item.depth,
      ey = square ? item.depth : item.width,
      horizontal = wall === "north" || wall === "south",
      at = along ?? (horizontal ? r.width : r.length) / 2,
      gap = opts.gap ?? 0.01;
    return wall === "north"
      ? { x: r.x + at, y: r.y + ey / 2 + gap, rotation }
      : wall === "south"
        ? { x: r.x + at, y: r.y + r.length - ey / 2 - gap, rotation }
        : wall === "west"
          ? { x: r.x + ex / 2 + gap, y: r.y + at, rotation }
          : { x: r.x + r.width - ex / 2 - gap, y: r.y + at, rotation };
  }
  against(roomId: string, wall: Side, along: number | null, catalogId: string, opts: { gap?: number; rotation?: number } = {}) {
    const s = this.spotAgainst(roomId, wall, along, catalogId, opts);
    return s ? this.put(roomId, catalogId, s.x, s.y, s.rotation) : (this.refusals.push(`${catalogId}: unknown`), null);
  }
  tryAgainst(roomId: string, wall: Side, along: number | null, catalogId: string, opts: { gap?: number; rotation?: number } = {}) {
    const s = this.spotAgainst(roomId, wall, along, catalogId, opts);
    return s ? this.put(roomId, catalogId, s.x, s.y, s.rotation, true) : null;
  }
  /** Anywhere it fits, preferring the given walls or a point. */
  trySomewhere(roomId: string, catalogId: string, opts: Parameters<typeof findFurnitureSpot>[3] = {}) {
    const room = this.room(roomId),
      item = itemFor(this.d, catalogId);
    if (!item) return null;
    // Along the walls (backed onto them), then anywhere on a half-foot grid.
    const walls = (opts.sides ?? (["north", "east", "south", "west"] as Side[])).flatMap((side) => alongWall(room, item, side, 0.25));
    const grid: Spot[] = [];
    for (const rotation of opts.freeStanding || item.mount === "ceiling" ? [0] : [0, 90, 180, 270])
      for (let y = room.y + 0.5; y <= room.y + room.length - 0.5; y += 0.5)
        for (let x = room.x + 0.5; x <= room.x + room.width - 0.5; x += 0.5) grid.push({ x, y, rotation });
    const spots = item.mount === "wall" ? walls : opts.freeStanding || item.mount === "ceiling" ? grid : [...walls, ...grid];
    if (opts.near) {
      const n = opts.near;
      spots.sort((a, c) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(c.x - n.x, c.y - n.y));
    }
    const p = this.tryFirst(roomId, catalogId, spots);
    if (!p) this.skipped.push(`${catalogId} in ${roomId}: no tidy spot`);
    return p;
  }
  /** How many pieces in a room lack the clear floor they need. */
  cramped(roomId: string) {
    return crampedIssues(this.d, (p) => p.roomId === roomId).length;
  }
  /**
   * The first spot of a list that validates and leaves the room no more cramped than
   * it was: optional pieces never take the space in front of a wardrobe or a bed.
   */
  tryFirst(roomId: string, catalogId: string, spots: (Spot | null)[], opts: { tidy?: boolean } = {}) {
    const before = opts.tidy === false ? 0 : this.cramped(roomId);
    for (const s of spots) {
      if (!s) continue;
      const room = this.room(roomId),
        piece = { id: this.id(`${roomId}-${catalogId}`), catalogId, roomId, floor: room.floor, ...s, rotation: ((s.rotation % 360) + 360) % 360 };
      // Cheap single-piece check first; the action re-validates the whole house.
      if (!validateFurniture({ ...this.d, furniture: [...this.d.furniture, piece] }, piece).ok) continue;
      const r = applyAction(this.d, { type: "furniture/add", piece });
      if (!r.applied) continue;
      const prev = this.d;
      this.d = r.design;
      if (opts.tidy === false || this.cramped(roomId) <= before) return piece;
      this.d = prev;
    }
    return null;
  }
  boundsOf(p: PlacedFurniture) {
    return footprintBounds(itemFor(this.d, p.catalogId)!, p);
  }
  result(): BuildResult {
    return { design: this.d, refusals: [...this.refusals], skipped: [...this.skipped] };
  }
}
export { opposite };
export type { Room };
