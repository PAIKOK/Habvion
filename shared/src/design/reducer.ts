import type { HomeDesign, Room } from "../types/home";
import { contains } from "../lib/geometry";
import { sameTarget } from "./finishes";
import { validateDesign } from "./validation";
import { issue, type DesignAction, type ApplyResult } from "./actions";
/** Pure: no timestamps, randomness, IO or derived geometry is stored here. */
export function applyAction(design: HomeDesign, action: DesignAction): ApplyResult {
  const fail = (code: string, message: string, ids?: string[]): ApplyResult => ({
    ok: false,
    applied: false,
    design,
    issues: [issue(code, message, ids)],
  });
  let next: HomeDesign = design;
  const room = "id" in action ? design.rooms.find((r) => r.id === action.id) : undefined;
  if (action.type.startsWith("room/") && action.type !== "room/add") {
    if (!room) return fail("room/not-found", "That room no longer exists.");
    if (
      room.locked &&
      !(
        action.type === "room/update" &&
        Object.keys(action.patch).length === 1 &&
        action.patch.locked === false
      )
    )
      return fail("room/locked", `${room.name} is locked. Unlock it before editing.`, [room.id]);
  }
  switch (action.type) {
    case "design/rename":
      next = { ...design, name: action.name };
      break;
    case "plot/update":
      next = { ...design, plot: { ...design.plot, ...action.patch } };
      break;
    case "floors/count":
      if (!Number.isInteger(action.count) || action.count < 1 || action.count > 10)
        return fail("floors/invalid", "Choose 1–10 floors.");
      if (
        design.rooms.some((r) => r.floor >= action.count) ||
        design.stairs.some((s) => s.toFloor >= action.count)
      )
        return fail("floors/occupied", "Remove rooms and stairs before deleting their floor.");
      next = {
        ...design,
        floors: Array.from(
          { length: action.count },
          (_, level) => design.floors[level] ?? { level, height: 10 },
        ),
      };
      break;
    case "floor/height":
      next = {
        ...design,
        floors: design.floors.map((f) =>
          f.level === action.level ? { ...f, height: action.height } : f,
        ),
      };
      break;
    case "room/add":
      if (design.rooms.some((r) => r.id === action.room.id))
        return fail("room/duplicate-id", "That room id is already used.");
      next = { ...design, rooms: [...design.rooms, action.room] };
      break;
    case "room/update": {
      const r: Room = { ...room!, ...action.patch };
      const dx = r.x - room!.x,
        dy = r.y - room!.y;
      next = {
        ...design,
        rooms: design.rooms.map((x) => (x.id === r.id ? r : x)),
        furniture: design.furniture.map((p) =>
          p.roomId === r.id ? { ...p, x: p.x + dx, y: p.y + dy, floor: r.floor } : p,
        ),
        // A stair belongs to the room it stands in, so it travels with a move.
        stairs: design.stairs.map((s) =>
          s.fromFloor === room!.floor && contains(room!, s)
            ? { ...s, x: s.x + dx, y: s.y + dy }
            : s,
        ),
      };
      break;
    }
    case "room/delete": {
      const id = action.id;
      next = {
        ...design,
        rooms: design.rooms.filter((r) => r.id !== id),
        doors: design.doors.filter((p) => p.roomId !== id),
        windows: design.windows.filter((p) => p.roomId !== id),
        furniture: design.furniture.filter((p) => p.roomId !== id),
        stairs: design.stairs.filter((s) => !(s.fromFloor === room!.floor && contains(room!, s))),
        paint: design.paint.filter((p) => p.target.roomId !== id),
        flooring: Object.fromEntries(Object.entries(design.flooring).filter(([key]) => key !== id)),
      };
      break;
    }
    case "room/duplicate":
      next = {
        ...design,
        rooms: [
          ...design.rooms,
          {
            ...room!,
            id: action.newId,
            name: room!.name + " copy",
            x: room!.x + action.dx,
            y: room!.y + action.dy,
            locked: false,
          },
        ],
        doors: [
          ...design.doors,
          ...design.doors
            .filter((o) => o.roomId === action.id)
            .map((o, i) => ({ ...o, id: `${action.newId}-d${i}`, roomId: action.newId })),
        ],
        windows: [
          ...design.windows,
          ...design.windows
            .filter((o) => o.roomId === action.id)
            .map((o, i) => ({ ...o, id: `${action.newId}-w${i}`, roomId: action.newId })),
        ],
      };
      break;
    case "door/add":
      next = { ...design, doors: [...design.doors, action.door] };
      break;
    case "door/update":
      if (!design.doors.some((o) => o.id === action.id))
        return fail("opening/not-found", "That door does not exist.");
      next = {
        ...design,
        doors: design.doors.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)),
      };
      break;
    case "door/delete":
      if (!design.doors.some((o) => o.id === action.id))
        return fail("opening/not-found", "That door does not exist.");
      next = { ...design, doors: design.doors.filter((o) => o.id !== action.id) };
      break;
    case "window/add":
      next = { ...design, windows: [...design.windows, action.window] };
      break;
    case "window/update":
      if (!design.windows.some((o) => o.id === action.id))
        return fail("opening/not-found", "That window does not exist.");
      next = {
        ...design,
        windows: design.windows.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)),
      };
      break;
    case "window/delete":
      if (!design.windows.some((o) => o.id === action.id))
        return fail("opening/not-found", "That window does not exist.");
      next = { ...design, windows: design.windows.filter((o) => o.id !== action.id) };
      break;
    case "stair/add":
      if (design.stairs.some((s) => s.id === action.stair.id))
        return fail("stair/duplicate-id", "That stair id is already used.");
      next = { ...design, stairs: [...design.stairs, action.stair] };
      break;
    case "stair/update":
      if (!design.stairs.some((s) => s.id === action.id))
        return fail("stair/not-found", "That stair does not exist.");
      next = {
        ...design,
        stairs: design.stairs.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
      break;
    case "stair/delete":
      if (!design.stairs.some((s) => s.id === action.id))
        return fail("stair/not-found", "That stair does not exist.");
      next = { ...design, stairs: design.stairs.filter((s) => s.id !== action.id) };
      break;
    case "furniture/add":
      if (design.furniture.some((f) => f.id === action.piece.id))
        return fail("furniture/duplicate-id", "That furniture id is already used.");
      next = { ...design, furniture: [...design.furniture, action.piece] };
      break;
    case "furniture/update": {
      const piece = design.furniture.find((f) => f.id === action.id);
      if (!piece) return fail("furniture/not-found", "That piece no longer exists.");
      if (piece.locked && action.patch.locked !== false)
        return fail("furniture/locked", "That piece is locked. Unlock it first.", [piece.id]);
      next = {
        ...design,
        furniture: design.furniture.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
      };
      break;
    }
    case "furniture/delete":
      if (!design.furniture.some((f) => f.id === action.id))
        return fail("furniture/not-found", "That piece no longer exists.");
      next = { ...design, furniture: design.furniture.filter((f) => f.id !== action.id) };
      break;
    case "paint/set":
    case "paint/clear": {
      const target = action.target;
      if (!design.rooms.some((r) => r.id === target.roomId))
        return fail("paint/no-room", "That room no longer exists.");
      const rest = design.paint.filter((p) => !sameTarget(p.target, target));
      next = {
        ...design,
        paint: action.type === "paint/set" ? [...rest, { target, colorHex: action.colorHex }] : rest,
      };
      break;
    }
    case "flooring/set": {
      if (!design.rooms.some((r) => r.id === action.roomId))
        return fail("flooring/no-room", "That room no longer exists.");
      const { [action.roomId]: _old, ...rest } = design.flooring;
      next = {
        ...design,
        flooring: action.flooring ? { ...rest, [action.roomId]: action.flooring } : rest,
      };
      break;
    }
    case "roof/set":
      next = { ...design, roof: action.roof };
      break;
    case "compound/set":
      next = { ...design, compound: action.compound };
      break;
    case "systems/set":
      next = { ...design, systems: { ...design.systems, ...action.patch } };
      break;
    case "parking/need":
      next = { ...design, parkingNeed: action.need };
      break;
    // Adding an item does not place it; placement is furniture/add by catalogId.
    case "custom-item/add":
      if ((design.customItems ?? []).some((i) => i.id === action.item.id))
        return fail("custom-item/duplicate", "An item with that id already exists.", [action.item.id]);
      next = { ...design, customItems: [...(design.customItems ?? []), action.item] };
      break;
    case "custom-item/remove": {
      if (!(design.customItems ?? []).some((i) => i.id === action.id))
        return fail("custom-item/not-found", "That imported item no longer exists.");
      const placed = design.furniture.filter((f) => f.catalogId === action.id);
      if (placed.length)
        return fail("custom-item/in-use", `Remove the ${placed.length === 1 ? "placed piece" : `${placed.length} placed pieces`} first.`, placed.map((f) => f.id));
      const customItems = design.customItems!.filter((i) => i.id !== action.id);
      next = { ...design, customItems: customItems.length ? customItems : undefined };
      if (!next.customItems) delete next.customItems;
      break;
    }
    // A narrow patch: the look (model, mesh job) changes, never the confirmed size.
    case "custom-item/set-model": {
      const item = (design.customItems ?? []).find((i) => i.id === action.id);
      if (!item) return fail("custom-item/not-found", "That imported item no longer exists.");
      const updated = { ...item };
      if (action.patch.modelUrl !== undefined) {
        if (action.patch.modelUrl === null) delete updated.modelUrl;
        else updated.modelUrl = action.patch.modelUrl;
      }
      if (action.patch.meshJob !== undefined) {
        if (action.patch.meshJob === null) delete updated.meshJob;
        else updated.meshJob = action.patch.meshJob;
      }
      next = { ...design, customItems: design.customItems!.map((i) => (i.id === action.id ? updated : i)) };
      break;
    }
    default:
      return fail("action/unknown", "That action is not supported.");
  }
  const validation = validateDesign(next);
  if (!validation.ok) return { ...validation, applied: false, design };
  return { ...validation, applied: true, design: { ...next, revision: design.revision + 1 } };
}
