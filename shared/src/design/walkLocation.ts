import type { HomeDesign, Point, Room } from "../types/home";
import { pointInPolygon } from "../lib/geometry";
import { elevation, roomFloorY } from "./levels";

export type WalkPose = Point & { feet: number; heading: number };
export type WalkLocation = WalkPose & {
  floor: number;
  roomId: string | null;
  roomName: string;
  onStairs: boolean;
  outsidePlot: boolean;
};
const inside = (p: Point, r: { x: number; y: number; width: number; length: number }) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.length;

/** Use feet height as well as plan coordinates: stacked rooms must not share a label. */
export function locateWalker(design: HomeDesign, pose: WalkPose): WalkLocation {
  let floor = 0;
  for (const f of design.floors) if (elevation(design, f.level) <= pose.feet + 0.2) floor = f.level;
  const stair = design.stairs.find(s => inside(pose, s) && pose.feet > elevation(design, s.fromFloor) + 0.3 && pose.feet < elevation(design, s.toFloor) - 0.2);
  let room: Room | undefined;
  if (stair) {
    floor = stair.fromFloor;
    room = design.rooms.find(r => r.floor === floor && inside(pose, r));
  } else {
    room = design.rooms.find(r => r.floor === floor && inside(pose, r) && Math.abs(pose.feet - roomFloorY(design, r)) < 0.35);
  }
  const outsidePlot = design.plot.polygon?.length
    ? !pointInPolygon(pose, design.plot.polygon)
    : !inside(pose, { x: 0, y: 0, width: design.plot.width, length: design.plot.length });
  return {
    ...pose, floor, roomId: room?.id ?? null,
    roomName: stair ? "Staircase" : room?.name ?? (outsidePlot ? "Outside plot" : "Outside"),
    onStairs: !!stair, outsidePlot,
  };
}
