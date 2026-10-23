import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import type { DesignAction } from "@shared/design/actions";
import type { HomeDesign } from "@shared/types/home";

/** Apply actions in order; collect refusals instead of throwing. */
export function build(design: HomeDesign, actions: DesignAction[]) {
  const refused: string[] = [];
  for (const a of actions) {
    const r = applyAction(design, a);
    if (r.applied) design = r.design;
    else refused.push(`${a.type}: ${r.issues.map((i) => i.message).join("; ")}`);
  }
  return { design, refused };
}
/** The same small two-storey house the browser smoke builds. */
export function sampleHouse() {
  return build(createDesign({ width: 30, length: 50, floors: 2 }), [
    { type: "room/add", room: { id: "liv", name: "Living", type: "living", x: 3, y: 6, width: 14, length: 14, floor: 0 } },
    { type: "room/add", room: { id: "kit", name: "Kitchen", type: "kitchen", x: 17, y: 6, width: 10, length: 10, floor: 0 } },
    { type: "room/add", room: { id: "core", name: "Stairs", type: "staircase", x: 17, y: 16, width: 10, length: 13, floor: 0 } },
    { type: "room/add", room: { id: "bed", name: "Bedroom", type: "bedroom", x: 3, y: 20, width: 14, length: 12, floor: 0 } },
    { type: "room/add", room: { id: "gar", name: "Garden", type: "garden", x: 3, y: 34, width: 24, length: 13, floor: 0 } },
    { type: "room/add", room: { id: "mb", name: "Master bedroom", type: "master-bedroom", x: 3, y: 6, width: 14, length: 14, floor: 1 } },
    { type: "room/add", room: { id: "lob", name: "Lobby", type: "hall", x: 17, y: 16, width: 10, length: 13, floor: 1 } },
    { type: "room/add", room: { id: "ter", name: "Terrace", type: "terrace", x: 3, y: 20, width: 14, length: 12, floor: 1 } },
    { type: "door/add", door: { id: "d1", roomId: "liv", side: "north", offset: 3, width: 3.5, height: 7, doorType: "panel", swing: "left" } },
    { type: "door/add", door: { id: "d2", roomId: "liv", side: "east", offset: 11, width: 3, height: 7, doorType: "flush", swing: "right" } },
    { type: "door/add", door: { id: "d3", roomId: "bed", side: "east", offset: 4, width: 3, height: 7, doorType: "flush", swing: "left" } },
    { type: "door/add", door: { id: "d4", roomId: "kit", side: "south", offset: 5, width: 3, height: 7, doorType: "sliding", swing: "left" } },
    { type: "door/add", door: { id: "d5", roomId: "lob", side: "west", offset: 4, width: 3, height: 7, doorType: "panel", swing: "left" } },
    { type: "door/add", door: { id: "d6", roomId: "lob", side: "west", offset: 10, width: 5, height: 7, doorType: "french", swing: "left" } },
    { type: "window/add", window: { id: "w1", roomId: "liv", side: "west", offset: 7, width: 5, height: 4.5, windowType: "casement", sill: 2.5 } },
    { type: "window/add", window: { id: "w2", roomId: "kit", side: "north", offset: 5, width: 4, height: 3.5, windowType: "sliding", sill: 3.5 } },
    { type: "window/add", window: { id: "w3", roomId: "bed", side: "south", offset: 7, width: 6, height: 4.5, windowType: "casement", sill: 2.5 } },
    { type: "window/add", window: { id: "w4", roomId: "mb", side: "north", offset: 7, width: 6, height: 4.5, windowType: "bay", sill: 2.5 } },
    { type: "stair/add", stair: { id: "st", x: 18.5, y: 17, width: 7, length: 11, fromFloor: 0, toFloor: 1, direction: "north", stairType: "dog-legged", turn: "left" } },
    { type: "furniture/add", piece: { id: "f1", catalogId: "sofa-3", roomId: "liv", x: 9, y: 18.4, rotation: 180, floor: 0 } },
    { type: "furniture/add", piece: { id: "f2", catalogId: "coffee-table", roomId: "liv", x: 9, y: 14.5, rotation: 0, floor: 0 } },
    { type: "furniture/add", piece: { id: "f3", catalogId: "tv-unit", roomId: "liv", x: 12.5, y: 6.8, rotation: 0, floor: 0 } },
    { type: "furniture/add", piece: { id: "f4", catalogId: "bed-queen", roomId: "bed", x: 8, y: 25.5, rotation: 270, floor: 0 } },
    { type: "furniture/add", piece: { id: "f5", catalogId: "counter-8", roomId: "kit", x: 22, y: 7.01, rotation: 0, floor: 0 } },
    { type: "furniture/add", piece: { id: "f6", catalogId: "shade-tree", roomId: "gar", x: 8, y: 40, rotation: 0, floor: 0 } },
    { type: "furniture/add", piece: { id: "f7", catalogId: "bed-king", roomId: "mb", x: 10, y: 15, rotation: 180, floor: 1 } },
    { type: "furniture/add", piece: { id: "f9", catalogId: "rug-medium", roomId: "liv", x: 9, y: 12, rotation: 0, floor: 0 } },
    { type: "roof/set", roof: { type: "flat", materialId: "rcc", pitchDeg: 22, overhangFt: 1 } },
  ]);
}
