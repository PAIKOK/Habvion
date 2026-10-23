import type { HomeDesign, Room, RoomType, Side } from "../types/home";
import type { DesignAction } from "../design/actions";
import type { AiAction } from "./schema";
import { applyAction } from "../design/reducer";
import { ROOM_INFO, roomName } from "../design/roomTypes";
import { freeRoomSpot } from "../design/placement";
import { validateRoom } from "../design/validation";
import { CATALOG, itemFor } from "../design/catalog";
import { furnishRoom } from "../design/furnish";
import { PAINT_SWATCHES, ROOF_MATERIALS, defaultCompound } from "../design/finishes";
import { roomBeyond } from "../design/audit";
import { EPS } from "../lib/geometry";

export type AiOutcome = { action: AiAction; applied: boolean; message: string };
const SIDES: Side[] = ["north", "east", "south", "west"];
let seq = 0;
const uid = (p: string) => `${p}-ai${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Resolve a room the user named: id, exact name, then partial name, then type. */
export function findRoom(d: HomeDesign, ref: string): Room | undefined {
  const q = ref.trim().toLowerCase(),
    norm = q.replace(/\s*room$/, "").replace(/\s+/g, "-");
  return (
    d.rooms.find((r) => r.id === ref) ??
    d.rooms.find((r) => r.name.toLowerCase() === q) ??
    d.rooms.find((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase())) ??
    d.rooms.find((r) => r.type === norm || r.type === (norm as RoomType)) ??
    d.rooms.find((r) => r.type.includes(norm))
  );
}
export function findItemId(d: HomeDesign, ref: string) {
  if (itemFor(d, ref)) return ref;
  const q = ref.toLowerCase().replace(/[-_]/g, " ");
  return [...(d.customItems ?? []), ...CATALOG].find((i) => i.name.toLowerCase() === q || i.name.toLowerCase().includes(q))?.id;
}
const COLOR_WORDS: Record<string, string> = {
  white: "Chalk white", cream: "Ivory", beige: "Warm sand", orange: "Terracotta", yellow: "Haldi",
  green: "Sage", teal: "Peacock", blue: "Indigo", pink: "Blush", grey: "Mist grey", gray: "Mist grey",
  black: "Charcoal", red: "Terracotta",
};
export function resolveColor(c: string) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const q = c.trim().toLowerCase(),
    name = COLOR_WORDS[q] ?? q;
  return PAINT_SWATCHES.find((s) => s.name.toLowerCase() === name.toLowerCase() || s.name.toLowerCase().includes(name.toLowerCase()))?.hex;
}
/** Where two rooms on the same floor touch: the side of `a` and the shared span on it. */
export function sharedSpan(a: Room, b: Room): { side: Side; start: number; end: number } | null {
  if (a.floor !== b.floor) return null;
  const ox0 = Math.max(a.x, b.x),
    ox1 = Math.min(a.x + a.width, b.x + b.width),
    oy0 = Math.max(a.y, b.y),
    oy1 = Math.min(a.y + a.length, b.y + b.length);
  if (Math.abs(a.y - (b.y + b.length)) < EPS && ox1 - ox0 > EPS) return { side: "north", start: ox0 - a.x, end: ox1 - a.x };
  if (Math.abs(a.y + a.length - b.y) < EPS && ox1 - ox0 > EPS) return { side: "south", start: ox0 - a.x, end: ox1 - a.x };
  if (Math.abs(a.x - (b.x + b.width)) < EPS && oy1 - oy0 > EPS) return { side: "west", start: oy0 - a.y, end: oy1 - a.y };
  if (Math.abs(a.x + a.width - b.x) < EPS && oy1 - oy0 > EPS) return { side: "east", start: oy0 - a.y, end: oy1 - a.y };
  return null;
}
const doorWidth = (r: Room) => (["bathroom", "attached-bathroom", "powder", "store", "pantry"].includes(r.type) ? 2.5 : 3);
function doorBetween(d: HomeDesign, a: Room, b: Room): DesignAction | null {
  const s = sharedSpan(a, b);
  if (!s) return null;
  const width = Math.min(doorWidth(a), doorWidth(b));
  if (s.end - s.start < width + 1) return null;
  return {
    type: "door/add",
    door: { id: uid("door"), roomId: a.id, side: s.side, offset: (s.start + s.end) / 2, width, height: 7, doorType: "panel", swing: "left" },
  };
}

/**
 * Turn assistant actions into reducer actions one at a time against the evolving
 * design. Each step is validated by the reducer; a refused step is reported and the
 * rest carry on. Nothing the assistant says is trusted beyond what validates.
 */
export function applyAiActions(design: HomeDesign, actions: AiAction[]): { design: HomeDesign; outcomes: AiOutcome[] } {
  let d = design;
  const outcomes: AiOutcome[] = [];
  const run = (a: DesignAction) => {
    const r = applyAction(d, a);
    if (r.applied) d = r.design;
    return r;
  };
  const say = (action: AiAction, applied: boolean, message: string) => outcomes.push({ action, applied, message });
  for (const action of actions) {
    const room = "room" in action ? findRoom(d, action.room) : undefined;
    if ("room" in action && !room) {
      say(action, false, `There is no room called "${action.room}".`);
      continue;
    }
    switch (action.type) {
      case "add_room": {
        const info = ROOM_INFO[action.roomType],
          near = action.near ? findRoom(d, action.near) : undefined,
          floor = action.floor ?? near?.floor ?? 0,
          width = action.width ?? info.width,
          length = action.length ?? info.length,
          base = { id: uid("room"), name: action.name ?? roomName(action.roomType, d.rooms.map((r) => r.name)), type: action.roomType, width, length, floor };
        let at: { x: number; y: number } | null = null;
        if (near) {
          const tries = [
            { x: near.x + near.width, y: near.y },
            { x: near.x - width, y: near.y },
            { x: near.x, y: near.y + near.length },
            { x: near.x, y: near.y - length },
            { x: near.x + near.width, y: near.y + near.length - length },
            { x: near.x + near.width - width, y: near.y + near.length },
          ];
          at = tries.find((p) => validateRoom(d, { ...base, ...p }).ok) ?? null;
        }
        if (!at) {
          const free = freeRoomSpot(d, action.roomType, floor);
          at = free && validateRoom(d, { ...base, ...free }).ok ? free : null;
        }
        if (!at) {
          say(action, false, `No free ${width}×${length} ft spot for a ${info.label.toLowerCase()} on that floor.`);
          break;
        }
        const r = run({ type: "room/add", room: { ...base, ...at } });
        if (!r.applied) {
          say(action, false, r.issues[0]?.message ?? "Refused.");
          break;
        }
        const added = d.rooms.find((x) => x.id === base.id)!;
        const door = near ? doorBetween(d, added, near) : null;
        const joined = door ? run(door).applied : false;
        say(action, true, `Added ${base.name}${near ? ` next to ${near.name}` : ""}${joined ? " with a door between them" : ""}.`);
        break;
      }
      case "resize_room": {
        const r = run({ type: "room/update", id: room!.id, patch: { ...(action.width ? { width: action.width } : {}), ...(action.length ? { length: action.length } : {}) } });
        say(action, r.applied, r.applied ? `Resized ${room!.name}.` : r.issues[0]!.message);
        break;
      }
      case "rename_room": {
        const r = run({ type: "room/update", id: room!.id, patch: { name: action.name } });
        say(action, r.applied, r.applied ? `Renamed to ${action.name}.` : r.issues[0]!.message);
        break;
      }
      case "delete_room": {
        const r = run({ type: "room/delete", id: room!.id });
        say(action, r.applied, r.applied ? `Removed ${room!.name}.` : r.issues[0]!.message);
        break;
      }
      case "add_furniture": {
        const id = findItemId(d, action.item);
        if (!id) {
          say(action, false, `"${action.item}" is not in the catalog.`);
          break;
        }
        let placed = 0;
        for (let i = 0; i < (action.count ?? 1); i++) {
          const r = furnishRoom(d, room!.id, [id]);
          if (!r.placed.length) break;
          d = r.design;
          placed++;
        }
        const name = itemFor(d, id)!.name;
        say(action, placed > 0, placed ? `Placed ${placed > 1 ? `${placed} × ` : ""}${name} in ${room!.name}.` : `${name} does not fit in ${room!.name}.`);
        break;
      }
      case "furnish_room": {
        const r = furnishRoom(d, room!.id);
        d = r.design;
        say(action, r.placed.length > 0, r.placed.length ? `Furnished ${room!.name} with ${r.placed.length} pieces${r.skipped.length ? `; ${r.skipped.length} did not fit` : ""}.` : r.skipped.length ? `Nothing more fitted in ${room!.name}.` : `${room!.name} already has its standard furniture.`);
        break;
      }
      case "remove_furniture": {
        const id = action.item ? findItemId(d, action.item) : undefined,
          pieces = d.furniture.filter((f) => f.roomId === room!.id && (!action.item || f.catalogId === id));
        for (const p of pieces) run({ type: "furniture/delete", id: p.id });
        say(action, pieces.length > 0, pieces.length ? `Removed ${pieces.length} piece(s) from ${room!.name}.` : "Nothing to remove.");
        break;
      }
      case "add_door": {
        const to = action.toRoom ? findRoom(d, action.toRoom) : undefined;
        let ok = false;
        if (to) {
          const a = doorBetween(d, room!, to);
          ok = !!a && run(a).applied;
          say(action, ok, ok ? `Added a door between ${room!.name} and ${to.name}.` : `${room!.name} and ${to.name} do not share enough wall for a door.`);
          break;
        }
        for (const side of action.side ? [action.side] : SIDES) {
          const len = side === "north" || side === "south" ? room!.width : room!.length,
            probe = { id: uid("door"), roomId: room!.id, side, offset: len / 2, width: 3.5, height: 7, doorType: "panel" as const, swing: "left" as const };
          if (!action.side && roomBeyond({ ...d, doors: [...d.doors, probe] }, probe)) continue;
          if (run({ type: "door/add", door: probe }).applied) {
            ok = true;
            break;
          }
        }
        say(action, ok, ok ? `Added an outside door to ${room!.name}.` : `No wall of ${room!.name} could take a door.`);
        break;
      }
      case "add_window": {
        let ok = false;
        for (const side of action.side ? [action.side] : SIDES) {
          const len = side === "north" || side === "south" ? room!.width : room!.length,
            probe = { id: uid("win"), roomId: room!.id, side, offset: len / 2, width: Math.min(4, len - 2), height: 4, windowType: "casement" as const, sill: 3 };
          if (probe.width < 1.5) continue;
          const beyond = roomBeyond({ ...d, windows: [...d.windows, probe] }, probe);
          if (!action.side && beyond && !["balcony", "terrace", "courtyard", "garden", "porch", "parking"].includes(beyond.type)) continue;
          if (run({ type: "window/add", window: probe }).applied) {
            ok = true;
            break;
          }
        }
        say(action, ok, ok ? `Added a window to ${room!.name}.` : `${room!.name} has no outside wall free for a window.`);
        break;
      }
      case "paint": {
        const hex = resolveColor(action.color);
        if (!hex) {
          say(action, false, `I do not know the colour "${action.color}".`);
          break;
        }
        const r = run({ type: "paint/set", target: action.side ? { kind: "wall", roomId: room!.id, side: action.side } : { kind: "room", roomId: room!.id }, colorHex: hex });
        say(action, r.applied, r.applied ? `Painted ${room!.name}${action.side ? `'s ${action.side} wall` : ""}.` : r.issues[0]!.message);
        break;
      }
      case "set_flooring": {
        const r = run({ type: "flooring/set", roomId: room!.id, flooring: action.flooring });
        say(action, r.applied, r.applied ? `Set ${room!.name}'s floor.` : r.issues[0]!.message);
        break;
      }
      case "set_floors": {
        const r = run({ type: "floors/count", count: action.count });
        say(action, r.applied, r.applied ? `The house now has ${action.count} floor(s).` : r.issues[0]!.message);
        break;
      }
      case "set_roof": {
        const material = action.material && ROOF_MATERIALS[action.material] ? action.material : action.roofType === "flat" ? "rcc" : "clay-tile",
          r = run({ type: "roof/set", roof: action.roofType === "none" ? null : { type: action.roofType, materialId: material, pitchDeg: 25, overhangFt: 1.5 } });
        say(action, r.applied, r.applied ? (action.roofType === "none" ? "Removed the roof; the top is an open terrace." : `Set a ${action.roofType} roof.`) : r.issues[0]!.message);
        break;
      }
      case "set_compound": {
        const r = run({ type: "compound/set", compound: action.enabled ? defaultCompound(d.plot) : null });
        say(action, r.applied, r.applied ? (action.enabled ? "Added a compound wall with gates." : "Removed the compound wall.") : r.issues[0]!.message);
        break;
      }
      case "set_systems": {
        const r = run({ type: "systems/set", patch: { ...(action.smartHome !== undefined ? { smartHome: action.smartHome } : {}), ...(action.security !== undefined ? { security: action.security } : {}) } });
        say(action, r.applied, "Updated home systems.");
        break;
      }
    }
  }
  return { design: d, outcomes };
}
