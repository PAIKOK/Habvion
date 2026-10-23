import type { HomeDesign, Room } from "../types/home";
import { floorBase } from "./createDesign";

/** The ground floor sits on a 9" plinth; floors are 6" slabs. Feet throughout. */
export const PLINTH = 0.75;
export const SLAB = 0.5;
const AT_GRADE = new Set(["garden", "parking", "courtyard"]);
export const elevation = (d: HomeDesign, level: number) => PLINTH + floorBase(d, level);
/** Height of a room's walking surface. Gardens, parking and courtyards sit at grade. */
export const roomFloorY = (d: HomeDesign, r: Room) =>
  r.floor === 0 && AT_GRADE.has(r.type) ? 0.05 : elevation(d, r.floor);
