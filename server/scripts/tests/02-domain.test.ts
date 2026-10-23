import { check } from "../check.js";
import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import { validateDesign } from "@shared/design/validation";
import { setbacksBySide } from "@shared/lib/geometry";
import { feet, inr } from "@shared/lib/units";
import type { Room } from "@shared/types/home";
const d = createDesign({ width: 30, length: 50, floors: 2 });
const r: Room = {
  id: "living",
  name: "Living",
  type: "living",
  x: 4,
  y: 6,
  width: 12,
  length: 12,
  floor: 0,
};
const add = applyAction(d, { type: "room/add", room: r });
check("valid room applies", add.applied && add.design.rooms.length === 1);
check("original is untouched", d.rooms.length === 0);
check("walls are not stored", !("walls" in d));
for (const [label, room, code] of [
  ["room outside plot", { ...r, id: "bad", x: 25 }, "room/outside-plot"],
  ["room overlap", { ...r, id: "overlap" }, "room/overlap"],
  ["too little area", { ...r, id: "small", width: 10, length: 10 }, "room/too-small"],
  ["too narrow", { ...r, id: "thin", width: 6, length: 25 }, "room/too-narrow"],
  ["missing floor", { ...r, id: "up", floor: 2 }, "room/no-floor"],
] as const) {
  const bad = applyAction(add.design, { type: "room/add", room });
  check(
    label + " is red and immutable",
    !bad.applied && bad.design === add.design && bad.issues.some((i) => i.code === code),
  );
}
check(
  "same footprint upstairs is valid",
  applyAction(add.design, { type: "room/add", room: { ...r, id: "up", floor: 1 } }).applied,
);
let locked = applyAction(add.design, {
  type: "room/update",
  id: r.id,
  patch: { locked: true },
}).design;
check(
  "locked room cannot move",
  !applyAction(locked, { type: "room/update", id: r.id, patch: { x: 7 } }).applied,
);
check(
  "unlock uses an action",
  applyAction(locked, { type: "room/update", id: r.id, patch: { locked: false } }).applied,
);
check(
  "plot cannot strand a room",
  !applyAction(add.design, { type: "plot/update", patch: { width: 10 } }).applied,
);
check("NaN is refused", !applyAction(d, { type: "room/add", room: { ...r, width: NaN } }).applied);
check(
  "minimum areas enforced by type",
  !applyAction(d, {
    type: "room/add",
    room: { ...r, type: "master-bedroom", width: 9, length: 10 },
  }).applied,
);
check("clockwise side is left of road", setbacksBySide(d.plot).east === d.plot.setbacks.left);
check("metric input converts to feet", Math.abs(feet(3.048, "m") - 10) < 1e-7);
check("Indian rupee grouping", inr(7777799) === "₹77,77,799");
check("a well-formed blank plot validates", validateDesign(d).ok);
