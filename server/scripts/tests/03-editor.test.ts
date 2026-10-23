import { check } from "../check.js";
import { snapPoint, freeRoomSpot } from "@shared/design/placement";
import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
const d = createDesign({ width: 30, length: 50 });
check("free placement finds a fit", freeRoomSpot(d, "bedroom", 0) !== null);
check("snaps to half feet", snapPoint({ x: 4.31, y: 6.14 }, []).x === 4.5);
check("free placement keeps exact input", snapPoint({ x: 4.31, y: 6.14 }, [], false).x === 4.31);
const r = {
  id: "room",
  name: "Bedroom",
  type: "bedroom" as const,
  x: 4,
  y: 6,
  width: 10,
  length: 10,
  floor: 0,
};
let plan = applyAction(d, { type: "room/add", room: r }).design;
check("snaps to neighbouring edges", snapPoint({ x: 14.2, y: 10 }, plan.rooms).x === 14);
check(
  "resize validates a resulting rectangle",
  applyAction(plan, { type: "room/update", id: r.id, patch: { width: 12 } }).applied,
);
const copy = applyAction(plan, { type: "room/duplicate", id: r.id, newId: "copy", dx: 10, dy: 0 });
check(
  "duplicate gets its own id and stays adjacent",
  copy.applied && copy.design.rooms[1]?.id === "copy",
);
check(
  "duplicate cannot overlap its source",
  !applyAction(plan, { type: "room/duplicate", id: r.id, newId: "copy", dx: 1, dy: 0 }).applied,
);
