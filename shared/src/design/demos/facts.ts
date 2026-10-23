import type { HomeDesign } from "../../types/home";
import { isOpenAir } from "../roomTypes";
import { estimateBudget } from "../budget";
import { plural } from "../../lib/units";

export type DemoFacts = {
  plot: { width: number; length: number; roadSide: string };
  builtUpArea: number;
  floors: number;
  bedrooms: number;
  bathrooms: number;
  powderRooms: number;
  cars: number;
  twoWheelers: number;
  /** "2 cars + 2 two-wheelers", "1 car", or "No parking". */
  parking: string;
  estimate: number;
  /** Ground-floor rooms for a plan thumbnail: x, y, width, length, open-air flag. */
  outline: [number, number, number, number, 0 | 1][];
};

const TWO_WHEELERS = ["scooter", "motorcycle"];

/** What a demo card says about a house, all counted from the design itself. */
export function demoFacts(d: HomeDesign): DemoFacts {
  const parkingRooms = new Set(d.rooms.filter((r) => r.type === "parking" || r.type === "garage").map((r) => r.id)),
    parked = d.furniture.filter((f) => parkingRooms.has(f.roomId)),
    cars = parked.filter((f) => f.catalogId.startsWith("car-")).length,
    twoWheelers = parked.filter((f) => TWO_WHEELERS.includes(f.catalogId)).length,
    budget = estimateBudget(d);
  const parking = [cars && plural(cars, "car"), twoWheelers && plural(twoWheelers, "two-wheeler")].filter(Boolean).join(" + ") || "No parking";
  return {
    plot: { width: d.plot.width, length: d.plot.length, roadSide: d.plot.roadSide },
    builtUpArea: Math.round(budget.builtUpArea),
    floors: d.floors.length,
    bedrooms: d.rooms.filter((r) => r.type.includes("bedroom")).length,
    bathrooms: d.rooms.filter((r) => r.type === "bathroom" || r.type === "attached-bathroom").length,
    powderRooms: d.rooms.filter((r) => r.type === "powder").length,
    cars,
    twoWheelers,
    parking,
    estimate: Math.round(budget.total),
    outline: d.rooms.filter((r) => r.floor === 0).map((r) => [r.x, r.y, r.width, r.length, isOpenAir(r.type) ? 1 : 0]),
  };
}
