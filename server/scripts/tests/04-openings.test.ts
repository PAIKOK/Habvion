import { check } from "../check.js";
import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import { deriveWalls, wallPanels } from "@shared/design/walls";
import { DOOR_TYPES } from "@shared/design/openingTypes";
import type { HomeDesign, Room, Door } from "@shared/types/home";
let d = createDesign({ width: 40, length: 50, floors: 2 });
const room = (
  id: string,
  x: number,
  y: number,
  width = 12,
  length = 12,
  type: Room["type"] = "living",
  floor = 0,
): Room => ({ id, name: id, type, x, y, width, length, floor });
d = applyAction(d, { type: "room/add", room: room("a", 4, 6) }).design;
check("four derived exterior walls", deriveWalls(d).length === 4);
d = applyAction(d, { type: "room/add", room: room("b", 16, 6) }).design;
check(
  "shared edge is one partition",
  deriveWalls(d).length === 7 && deriveWalls(d).filter((w) => w.owners.length === 2).length === 1,
);
const door: Door = {
  id: "door",
  roomId: "a",
  side: "east",
  offset: 6,
  width: 3,
  height: 7,
  doorType: "panel",
  swing: "left",
};
const added = applyAction(d, { type: "door/add", door });
check("door fits on shared wall", added.applied);
d = added.design;
const partition = deriveWalls(d).find((w) => w.owners.length === 2)!;
check("wall is split around door", wallPanels(d, partition).length === 3);
check(
  "panels subtract exact opening area",
  Math.abs(wallPanels(d, partition).reduce((n, p) => n + p.width * p.height, 0) - (120 - 21)) <
    1e-6,
);
check(
  "other room cannot claim the same physical opening",
  !applyAction(d, { type: "door/add", door: { ...door, id: "other", roomId: "b", side: "west" } })
    .applied,
);
check(
  "corner clearance is enforced",
  !applyAction(d, { type: "door/update", id: "door", patch: { offset: 1 } }).applied,
);
check(
  "minimum width is per type",
  !applyAction(d, { type: "door/update", id: "door", patch: { doorType: "french" } }).applied,
);
check("sliding doors do not swing", DOOR_TYPES.sliding.swings === false);
check(
  "resize cannot strand a door",
  !applyAction(d, { type: "room/update", id: "a", patch: { length: 5 } }).applied,
);
let open = createDesign({ width: 40, length: 50, floors: 2 });
open = applyAction(open, { type: "room/add", room: room("garden", 0, 0, 12, 12, "garden") }).design;
check("ground open air has no walls", deriveWalls(open).length === 0);
open = applyAction(open, {
  type: "room/add",
  room: room("deck", 0, 0, 12, 12, "terrace", 1),
}).design;
check(
  "upper open air has 3.5ft parapets",
  deriveWalls(open).every((w) => w.height === 3.5),
);
open = applyAction(open, {
  type: "room/add",
  room: room("deck2", 12, 0, 12, 12, "terrace", 1),
}).design;
check(
  "two decks have no shared parapet",
  deriveWalls(open).every((w) => w.owners.length === 1),
);
let mixed = createDesign({ width: 40, length: 50, floors: 2 });
for (const r of [room("bed", 0, 0, 12, 12, "bedroom", 1), room("bal", 12, 0, 5, 12, "balcony", 1)])
  mixed = applyAction(mixed, { type: "room/add", room: r }).design;
check("enclosing claim wins", deriveWalls(mixed).find((w) => w.owners.length === 2)?.height === 10);
let partial = createDesign({ width: 40, length: 50 });
for (const r of [room("large", 0, 0, 12, 20), room("short", 12, 0, 12, 12)])
  partial = applyAction(partial, { type: "room/add", room: r }).design;
check(
  "partial edge is split not duplicated",
  deriveWalls(partial).filter((w) => w.a.x === 12 && w.b.x === 12).length === 2,
);
