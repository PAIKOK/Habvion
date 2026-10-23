import { check } from "../check.js";
import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import { compoundSegments, defaultCompound, flooringOf, wallColor, DEFAULT_WALL } from "@shared/design/finishes";
import type { HomeDesign } from "@shared/types/home";

let d: HomeDesign = createDesign({ width: 30, length: 50, floors: 1 });
const go = (a: Parameters<typeof applyAction>[1]) => {
  const r = applyAction(d, a);
  if (r.applied) d = r.design;
  return r;
};
go({ type: "room/add", room: { id: "b", name: "Bedroom", type: "bedroom", x: 4, y: 6, width: 12, length: 12, floor: 0 } });
go({ type: "room/add", room: { id: "t", name: "Bath", type: "bathroom", x: 16, y: 6, width: 6, length: 8, floor: 0 } });
check("unpainted walls use the default", wallColor(d, "b", "north") === DEFAULT_WALL);
go({ type: "paint/set", target: { kind: "room", roomId: "b" }, colorHex: "#b7c4a4" });
go({ type: "paint/set", target: { kind: "wall", roomId: "b", side: "north" }, colorHex: "#c8714f" });
check("a room coat paints its walls", wallColor(d, "b", "east") === "#b7c4a4");
check("an accent wall overrides the room coat", wallColor(d, "b", "north") === "#c8714f");
go({ type: "paint/set", target: { kind: "room", roomId: "b" }, colorHex: "#cfe5d6" });
check("repainting replaces rather than stacks", d.paint.length === 2);
go({ type: "paint/clear", target: { kind: "wall", roomId: "b", side: "north" } });
check("clearing the accent falls back to the room coat", wallColor(d, "b", "north") === "#cfe5d6");
check("bad colours are refused", !go({ type: "paint/set", target: { kind: "room", roomId: "b" }, colorHex: "green" }).applied);
check("bathrooms default to anti-skid", flooringOf(d, d.rooms[1]!) === "anti-skid");
go({ type: "flooring/set", roomId: "b", flooring: "wood" });
check("flooring can be chosen", flooringOf(d, d.rooms[0]!) === "wood");
go({ type: "flooring/set", roomId: "b", flooring: null });
check("and reset to the default", flooringOf(d, d.rooms[0]!) === "laminate");
check("roof can be set", go({ type: "roof/set", roof: { type: "gable", materialId: "clay-tile", pitchDeg: 25, overhangFt: 1.5 } }).applied);
check("absurd pitches are refused", !go({ type: "roof/set", roof: { type: "gable", materialId: "clay-tile", pitchDeg: 80, overhangFt: 1 } }).applied);
const c = defaultCompound(d.plot);
check("the default compound is valid", go({ type: "compound/set", compound: c }).applied);
check("gates leave gaps in the boundary wall", compoundSegments(d.plot, c).length === 6);
check(
  "overlapping gates are refused",
  !go({ type: "compound/set", compound: { ...c, pedestrianGate: { ...c.pedestrianGate!, offset: c.gate.offset + 2 } } }).applied,
);
check(
  "a gate must fit on its boundary",
  !go({ type: "compound/set", compound: { ...c, gate: { ...c.gate, offset: 2 } } }).applied,
);
check("vehicle gates need 8 ft", !go({ type: "compound/set", compound: { ...c, gate: { ...c.gate, width: 6 } } }).applied);
check(
  "a gate off the road side is only a warning",
  (() => {
    const r = applyAction(d, { type: "compound/set", compound: { ...c, pedestrianGate: undefined, gate: { ...c.gate, side: "east", offset: 20 } } });
    return r.applied && r.issues.some((i) => i.code === "compound/gate-off-road");
  })(),
);
go({ type: "systems/set", patch: { security: true } });
check("systems toggle independently", d.systems.security && !d.systems.smartHome);
go({ type: "room/delete", id: "b" });
check("deleting a room drops its finishes", d.paint.length === 0 && !("b" in d.flooring));
