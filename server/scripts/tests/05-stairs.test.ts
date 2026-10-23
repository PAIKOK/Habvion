import { check } from "../check.js";
import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import { freeRoomSpot } from "@shared/design/placement";
import { buildableRect, contains } from "@shared/lib/geometry";
import {
  STAIR_TYPES,
  HEADROOM_FT,
  MAX_RISER_IN,
  arrivalsOf,
  stairGeometry,
  stairWell,
} from "@shared/design/stairs";
import { STAIR_TYPE_IDS, type HomeDesign, type Stair, type Side } from "@shared/types/home";

let d: HomeDesign = createDesign({ width: 40, length: 60, floors: 2 });
d = applyAction(d, {
  type: "room/add",
  room: {
    id: "core",
    name: "Stair core",
    type: "staircase",
    x: 6,
    y: 10,
    width: 16,
    length: 20,
    floor: 0,
  },
}).design;
const stair = (
  stairType: Stair["stairType"],
  direction: Side = "north",
  turn: Stair["turn"] = "left",
): Stair => {
  const info = STAIR_TYPES[stairType],
    ns = direction === "north" || direction === "south";
  return {
    id: "s",
    x: 8,
    y: 12,
    width: ns ? info.width : info.length,
    length: ns ? info.length : info.width,
    fromFloor: 0,
    toFloor: 1,
    direction,
    stairType,
    turn,
  };
};
for (const type of STAIR_TYPE_IDS) {
  const s = stair(type),
    r = applyAction(d, { type: "stair/add", stair: s }),
    g = stairGeometry(s, 10),
    top = Math.max(...g.parts.map((p) => p.z));
  check(
    `${type}: accepted at its default size`,
    r.applied,
    r.issues.map((i) => i.message).join("; "),
  );
  check(`${type}: climbs exactly one storey`, Math.abs(top - 10) < 1e-6, `top ${top}`);
  check(`${type}: risers within ${MAX_RISER_IN}"`, g.riseIn <= MAX_RISER_IN + 1e-9);
  for (const a of arrivalsOf(r.design, s))
    check(
      `${type}: arrival at least 3 ft deep`,
      Math.max(a.width, a.length) >= Math.max(3, Math.min(a.width, a.length)) - 1e-6 &&
        Math.max(a.width, a.length) >= 3 - 1e-6,
    );
  // Climbing north starts at the south edge; a half-turn returns to it.
  const a = arrivalsOf(r.design, s)[0]!,
    startEdge = s.y + s.length;
  if (STAIR_TYPES[type].halfTurn && type !== "helical")
    check(
      `${type}: half-turn arrives at its starting end`,
      a.y >= startEdge - 1e-6 || a.y + a.length > s.y + s.length / 2,
    );
  const well = stairWell(r.design, s);
  check(`${type}: well lies inside the stair`, !!well && contains(s, well));
}
{
  const s = stair("straight"),
    g = stairGeometry(s, 10),
    low = g.parts.filter((p) => p.z <= 10 - HEADROOM_FT),
    well = stairWell(applyAction(d, { type: "stair/add", stair: s }).design, s)!;
  check(
    "straight: the well leaves the low treads under a solid slab",
    low.length > 0 && well.length < s.length,
  );
  check(
    "straight: arrival is beyond the far end",
    arrivalsOf(d, s)[0]!.y + arrivalsOf(d, s)[0]!.length <= s.y + 1e-6,
  );
  const east = stair("straight", "east");
  check(
    "east-bound straight arrives east",
    arrivalsOf(d, east)[0]!.x >= east.x + east.width - 1e-6,
  );
  const right = stair("l-shaped", "north", "right"),
    left = stair("l-shaped", "north", "left");
  check(
    "L turns the way it says",
    arrivalsOf(d, right)[0]!.x >= right.x + right.width - 1e-6 &&
      arrivalsOf(d, left)[0]!.x + 3 <= left.x + 1e-6,
  );
  check("bifurcated arrives on both sides", arrivalsOf(d, stair("bifurcated")).length === 2);
}
check(
  "a stair needs a floor above",
  !applyAction(createDesign({ width: 40, length: 60, floors: 1 }), {
    type: "stair/add",
    stair: stair("straight"),
  }).applied,
);
check(
  "a stair must stand inside a room",
  !applyAction(d, { type: "stair/add", stair: { ...stair("straight"), x: 30 } }).applied,
);
check(
  "undersized stairs are refused",
  !applyAction(d, { type: "stair/add", stair: { ...stair("u-shaped"), width: 5 } }).applied,
);
{
  let e = applyAction(d, { type: "stair/add", stair: stair("dog-legged") }).design;
  e = applyAction(e, { type: "room/update", id: "core", patch: { x: 10 } }).design;
  check("a stair moves with its room", e.stairs[0]!.x === 12);
  check(
    "a floor holding a stair cannot be removed",
    !applyAction(e, { type: "floors/count", count: 1 }).applied,
  );
  e = applyAction(e, { type: "room/delete", id: "core" }).design;
  check("deleting the room removes its stair", e.stairs.length === 0);
}
{
  const plain = createDesign({ width: 30, length: 50, floors: 1 }),
    p = freeRoomSpot(plain, "bedroom", 0)!;
  check(
    "Add room lands inside the setbacks",
    contains(buildableRect(plain.plot), { ...p, width: 10, length: 10 }),
    JSON.stringify(p),
  );
  const tight = applyAction(plain, {
    type: "plot/update",
    patch: { roadSide: "east", setbacks: { front: 15, rear: 15, left: 3, right: 3 } },
  });
  check("setbacks are checked against the axis they eat into", !tight.applied);
}
