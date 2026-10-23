import { check } from "../check.js";
import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import { CATALOG, itemFor } from "@shared/design/catalog";
import { itemSchema } from "@shared/design/schemas";
import { findFurnitureSpot, footprintBounds, validateFurniture, backSide } from "@shared/design/furniture";
import { SHAPES, type HomeDesign, type PlacedFurniture } from "@shared/types/home";

check("catalog holds about 185 items", CATALOG.length >= 180, String(CATALOG.length));
check("catalog ids are unique", new Set(CATALOG.map((i) => i.id)).size === CATALOG.length);
check(
  "every item passes the item schema",
  CATALOG.every((i) => itemSchema.safeParse(i).success),
  CATALOG.filter((i) => !itemSchema.safeParse(i).success).map((i) => i.id).join(","),
);
check("every shape is drawable", CATALOG.every((i) => (SHAPES as readonly string[]).includes(i.shape)));
check(
  "Indian items are present",
  ["charpai", "jhoola", "mandir", "tulsi", "almirah", "diwan", "chowki", "geyser", "indian-wc"].every((id) =>
    CATALOG.some((i) => i.id === id),
  ),
);
check("vehicles carry no build cost", CATALOG.filter((i) => i.category === "vehicles").every((i) => i.price === 0));

let d: HomeDesign = createDesign({ width: 40, length: 60, floors: 2 });
const add = (action: Parameters<typeof applyAction>[1]) => {
  const r = applyAction(d, action);
  if (r.applied) d = r.design;
  return r;
};
add({ type: "room/add", room: { id: "liv", name: "Living", type: "living", x: 5, y: 6, width: 14, length: 16, floor: 0 } });
add({ type: "room/add", room: { id: "bed", name: "Bedroom", type: "bedroom", x: 19, y: 6, width: 12, length: 12, floor: 0 } });
add({
  type: "door/add",
  door: { id: "d1", roomId: "liv", side: "east", offset: 3, width: 3, height: 7, doorType: "panel", swing: "left" },
});
const piece = (id: string, catalogId: string, x: number, y: number, rotation = 0, roomId = "liv"): PlacedFurniture => ({
  id,
  catalogId,
  roomId,
  x,
  y,
  rotation,
  floor: 0,
});
const spot = findFurnitureSpot(d, "liv", "sofa-3")!;
check("a spot is found for a sofa", !!spot);
check("the sofa backs onto a wall", backSide(spot.rotation) !== null);
check("placing at the found spot is accepted", add({ type: "furniture/add", piece: piece("sofa", "sofa-3", spot.x, spot.y, spot.rotation) }).applied);
check(
  "two sofas cannot share floor",
  !applyAction(d, { type: "furniture/add", piece: piece("sofa2", "sofa-3", spot.x + 1, spot.y, spot.rotation) }).applied,
);
check(
  "a rug may lie under a sofa",
  add({ type: "furniture/add", piece: piece("rug", "rug-medium", spot.x, spot.y + 1, spot.rotation) }).applied,
);
check(
  "a table lamp needs something under it",
  !applyAction(d, { type: "furniture/add", piece: piece("lamp", "table-lamp", 12, 14) }).applied,
);
add({ type: "furniture/add", piece: piece("ns", "nightstand", 25, 7, 0, "bed") });
check(
  "a table lamp on a nightstand is fine",
  add({ type: "furniture/add", piece: { ...piece("lamp", "table-lamp", 25, 7, 0, "bed") } }).applied,
);
check(
  "wall items must be fixed to a wall",
  !applyAction(d, { type: "furniture/add", piece: piece("tv", "tv-55", 12, 14) }).applied,
);
check(
  "a wall TV on the north wall is fine",
  applyAction(d, { type: "furniture/add", piece: piece("tv", "tv-55", 12, 6 + 0.15) }).applied,
);
check(
  "furniture may not block a door swing",
  !applyAction(d, { type: "furniture/add", piece: piece("chair", "accent-chair", 17.5, 9.5) }).applied,
);
check(
  "furniture must stay inside its room",
  !applyAction(d, { type: "furniture/add", piece: piece("chair", "accent-chair", 19, 15) }).applied,
);
{
  const item = itemFor(d, "bed-queen")!,
    turned = footprintBounds(item, { x: 0, y: 0, rotation: 90 });
  check("a quarter turn swaps the footprint", Math.abs(turned.width - item.depth) < 1e-9);
}
check(
  "unsuitable rooms are a warning, not a refusal",
  (() => {
    const r = applyAction(d, { type: "furniture/add", piece: piece("wc", "wc", 25, 16, 180, "bed") });
    return r.applied && r.issues.some((i) => i.code === "furniture/unsuitable");
  })(),
);
{
  add({ type: "room/add", room: { id: "core", name: "Stairs", type: "staircase", x: 5, y: 30, width: 10, length: 14, floor: 0 } });
  add({ type: "room/add", room: { id: "up", name: "Landing", type: "hall", x: 5, y: 30, width: 10, length: 14, floor: 1 } });
  add({
    type: "stair/add",
    stair: { id: "st", x: 6, y: 31, width: 7, length: 11, fromFloor: 0, toFloor: 1, direction: "north", stairType: "dog-legged", turn: "left" },
  });
  check(
    "nothing stands on a stair",
    !applyAction(d, { type: "furniture/add", piece: { ...piece("p", "plant-floor", 9, 36, 0, "core") } }).applied,
  );
  check(
    "nothing stands over the stairwell upstairs",
    !applyAction(d, { type: "furniture/add", piece: { ...piece("p", "plant-floor", 9, 36, 0, "up"), floor: 1 } }).applied,
  );
}
{
  const before = d.furniture.find((f) => f.id === "sofa")!;
  add({ type: "room/update", id: "liv", patch: { x: 4 } });
  check("furniture moves with its room", d.furniture.find((f) => f.id === "sofa")!.x === before.x - 1);
  add({ type: "room/delete", id: "liv" });
  check("deleting a room removes its furniture", !d.furniture.some((f) => f.roomId === "liv"));
}
check(
  "validateFurniture rejects unknown items",
  !validateFurniture(d, piece("x", "no-such-item", 25, 12, 0, "bed")).ok,
);
