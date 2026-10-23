import { check } from "../check.js";
import { sampleHouse } from "../fixtures.js";
import { EYE, barriers, groundAt, startPosition, surfaces, walk } from "@shared/design/walk";
import { elevation } from "@shared/design/levels";
import { locateWalker } from "@shared/design/walkLocation";
import type { Point } from "@shared/types/home";

const { design: d, refused } = sampleHouse();
check("fixture house builds cleanly", refused.length === 0, refused.join(" | "));
const B = barriers(d),
  S = surfaces(d);
/** Walk in small steps like the frame loop does, settling onto the ground each step. */
function stroll(from: Point, to: Point, feet = groundAt(S, from, 0), steps = 200) {
  let p = from;
  for (let i = 0; i < steps; i++) {
    const dx = to.x - p.x,
      dy = to.y - p.y,
      len = Math.hypot(dx, dy);
    if (len < 0.05) break;
    const k = Math.min(0.15, len) / len;
    p = walk(B, p, { x: dx * k, y: dy * k }, feet);
    const g = groundAt(S, p, feet);
    feet = g >= feet ? g : Math.max(g, feet - 0.5);
  }
  return { p, feet };
}
const start = startPosition(d);
check("the walk starts outside the entrance, facing in", start.p.y < 6 && start.heading === 180, JSON.stringify(start));
check("eye height is a person's", EYE > 5 && EYE < 6);
const inside = stroll(start.p, { x: start.p.x, y: 10 });
check("you can walk in through the front door", inside.p.y > 9.5, JSON.stringify(inside));
check("and step up onto the plinth", Math.abs(inside.feet - elevation(d, 0)) < 1e-6);
const wall = stroll({ x: 10, y: 3 }, { x: 10, y: 10 });
check("a wall stops you", wall.p.y < 6, JSON.stringify(wall));
const window = stroll({ x: 1.5, y: 13 }, { x: 8, y: 13 });
check("a window's sill wall stops you", window.p.x < 3, JSON.stringify(window));
const sofa = stroll({ x: 9, y: 16 }, { x: 9, y: 19.5 }, elevation(d, 0));
check("a sofa stops you", sofa.p.y < 17.2, JSON.stringify(sofa));
const rug = stroll({ x: 5, y: 12 }, { x: 13, y: 12 }, elevation(d, 0));
check("a rug does not", rug.p.x > 12.5);
// Climb the dog-legged stair: up the east flight northwards, across the landing, down the west flight.
let at = { p: { x: 23.8, y: 28.6 }, feet: elevation(d, 0) };
at = stroll(at.p, { x: 23.5, y: 19.5 }, at.feet);
check("going up the first flight raises you", at.feet > elevation(d, 0) + 3, JSON.stringify(at));
at = stroll(at.p, { x: 20.2, y: 18.5 }, at.feet);
at = stroll(at.p, { x: 20.2, y: 28.5 }, at.feet);
check("the second flight brings you to the first floor", Math.abs(at.feet - elevation(d, 1)) < 0.05, JSON.stringify(at));
const terrace = stroll({ x: 10, y: 25 }, { x: 10, y: 33 }, elevation(d, 1));
check("a terrace parapet stops you", terrace.p.y < 32, JSON.stringify(terrace));
const boundary = stroll({ x: 20, y: 44 }, { x: 20, y: 55 }, 0.05);
check("the compound-free plot lets you leave, nothing invisible stops you", boundary.p.y > 50);

// The location label and mini-map must distinguish vertically stacked rooms.
{
  const at = (x: number, y: number, feet: number) => locateWalker(d, { x, y, feet, heading: 180 });
  const ground = at(9, 10, elevation(d, 0)), upper = at(9, 10, elevation(d, 1));
  check("walk location identifies the ground-floor living room", ground.roomId === "liv" && ground.roomName === "Living" && ground.floor === 0);
  check("walk location identifies the upper bedroom at the same plan position", upper.roomId === "mb" && upper.floor === 1);
  check("standing below an indoor floor does not claim to be inside it", at(9, 10, 0).roomId === null);
  check("at-grade gardens are named rather than labelled outside", at(8, 40, 0.05).roomId === "gar" && at(8, 40, 0.05).roomName === "Garden");
  const outside = at(2, 2, 0), offPlot = at(-3, -4, 0);
  check("outside rooms and outside the plot have distinct labels", outside.roomName === "Outside" && !outside.outsidePlot && offPlot.roomName === "Outside plot" && offPlot.outsidePlot);
  const onStair = at(23.5, 22, elevation(d, 0) + 3.5);
  check("walking between levels is identified as the staircase", onStair.onStairs && onStair.roomId === "core" && onStair.roomName === "Staircase" && onStair.floor === 0);
  const arrived = at(20.2, 28.5, elevation(d, 1));
  check("the mini-map changes to the upper floor at the stair arrival", !arrived.onStairs && arrived.floor === 1 && arrived.roomId === "lob");
  const porchHome: typeof d = { ...d, rooms: [...d.rooms, { id: "front-porch", name: "Entrance porch", type: "porch", x: 3, y: 2, width: 14, length: 4, floor: 0 }] };
  const porchStart = startPosition(porchHome);
  check("a front door opening onto a porch still starts the walk at the main entrance", porchStart.heading === 180 && Math.abs(porchStart.p.x - start.p.x) < 0.01 && Math.abs(porchStart.p.y - start.p.y) < 0.01);
}
