import type { FurnitureItem, HomeDesign, Room } from "../types/home";
import { validateOpening } from "./openings";
import { validateStair } from "./stairs";
import { validateFurniture } from "./furniture";
import { validateCompound } from "./finishes";
import { ROOM_INFO, isOpenAir } from "./roomTypes";
import { buildableRect, contains, overlap, withinPlot } from "../lib/geometry";
import { homeDesignSchema, itemSchema, roomSchema } from "./schemas";
import { isCatalogId } from "./catalog";
import { issue, type Issue, type ValidationResult } from "./actions";
export const result = (issues: Issue[]): ValidationResult => ({
  ok: !issues.some((i) => i.level === "error"),
  issues: [
    ...issues.filter((i) => i.level === "error"),
    ...issues.filter((i) => i.level !== "error"),
  ],
});
export function validateRoom(design: HomeDesign, room: Room): ValidationResult {
  const parsed = roomSchema.safeParse(room);
  if (!parsed.success)
    return result([
      issue(
        "room/invalid",
        parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
        [room.id],
      ),
    ]);
  const issues: Issue[] = [],
    info = ROOM_INFO[room.type];
  if (Math.min(room.width, room.length) < info.minWidth)
    issues.push(
      issue("room/too-narrow", `${room.name} needs a minimum clear width of ${info.minWidth} ft.`, [
        room.id,
      ]),
    );
  if (room.width * room.length < info.minArea)
    issues.push(
      issue(
        "room/too-small",
        `${room.name} needs at least ${info.minArea} sq ft; this is ${room.width * room.length}.`,
        [room.id],
      ),
    );
  if (!design.floors.some((f) => f.level === room.floor))
    issues.push(issue("room/no-floor", "That floor does not exist.", [room.id]));
  if (!withinPlot(design.plot, room))
    issues.push(
      issue("room/outside-plot", `${room.name} extends beyond the plot boundary.`, [room.id]),
    );
  for (const other of design.rooms)
    if (other.id !== room.id && other.floor === room.floor && overlap(other, room))
      issues.push(
        issue("room/overlap", `${room.name} overlaps ${other.name}.`, [room.id, other.id]),
      );
  if (!isOpenAir(room.type) && !contains(buildableRect(design.plot), room))
    issues.push(
      issue(
        "room/in-setback",
        `${room.name} enters a setback. Verify your local bye-laws.`,
        [room.id],
        "warning",
      ),
    );
  return result(issues);
}
/**
 * An item imported onto this design. Its id is namespaced and unique against both the
 * catalog and the design's other imports; its size is what the person confirmed.
 */
export function validateCustomItem(design: HomeDesign, item: FurnitureItem): ValidationResult {
  const parsed = itemSchema.safeParse(item);
  if (!parsed.success)
    return result([issue("custom-item/invalid", parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "), [item.id])]);
  const issues: Issue[] = [];
  if (!item.id.startsWith("custom-")) issues.push(issue("custom-item/id", "Imported item ids start with \"custom-\".", [item.id]));
  if (isCatalogId(item.id) || (design.customItems ?? []).filter((i) => i.id === item.id).length > 1)
    issues.push(issue("custom-item/duplicate", "An item with that id already exists.", [item.id]));
  for (const [label, v] of [["Width", item.width], ["Depth", item.depth], ["Height", item.height]] as const)
    if (v < 0.1 || v > 20) issues.push(issue("custom-item/size", `${label} must be between 0.1 and 20 ft.`, [item.id]));
  return result(issues);
}
export function validateDesign(design: HomeDesign): ValidationResult {
  const parsed = homeDesignSchema.safeParse(design);
  if (!parsed.success)
    return result([
      issue(
        "design/invalid",
        parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
      ),
    ]);
  const issues: Issue[] = [];
  const ids = [
    ...design.rooms,
    ...design.doors,
    ...design.windows,
    ...design.stairs,
    ...design.furniture,
  ].map((x) => x.id);
  if (new Set(ids).size !== ids.length)
    issues.push(issue("design/duplicate-id", "Entity ids must be unique across the design."));
  if (!design.floors.every((f, i) => f.level === i))
    issues.push(issue("floors/not-contiguous", "Floors must be consecutive from ground level."));
  // Front/rear run across the road axis and left/right along it, so compare each pair
  // against the plot dimension it actually eats into.
  const buildable = buildableRect(design.plot);
  if (buildable.width < 1 || buildable.length < 1)
    issues.push(issue("plot/setbacks", "The setbacks leave no usable building area."));
  issues.push(
    ...design.rooms.flatMap((r) => validateRoom(design, r).issues),
    ...[...design.doors, ...design.windows].flatMap((o) => validateOpening(design, o).issues),
    ...design.stairs.flatMap((s) => validateStair(design, s).issues),
    ...design.furniture.flatMap((f) => validateFurniture(design, f).issues),
    ...(design.compound ? validateCompound(design, design.compound) : []),
    ...(design.customItems ?? []).flatMap((i) => validateCustomItem(design, i).issues),
  );
  const roomIds = new Set(design.rooms.map((r) => r.id));
  if (design.paint.some((p) => !roomIds.has(p.target.roomId)) || Object.keys(design.flooring).some((id) => !roomIds.has(id)))
    issues.push(issue("design/orphan-finish", "A finish refers to a room that does not exist."));
  return result(issues);
}
