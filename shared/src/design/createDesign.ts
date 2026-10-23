import type { HomeDesign, Plot, Unit, Side } from "../types/home";
import { homeDesignSchema } from "./schemas";
export type NewDesignInput = {
  width: number;
  length: number;
  unit?: Unit;
  roadSide?: Side;
  floors?: number;
  parkingNeed?: HomeDesign["parkingNeed"];
  setbacks?: Plot["setbacks"];
  name?: string;
  id?: string;
  now?: string;
};
export const newId = (prefix = "item") => `${prefix}-${globalThis.crypto.randomUUID()}`;
export function createDesign(input: NewDesignInput): HomeDesign {
  const now = input.now ?? new Date().toISOString();
  return homeDesignSchema.parse({
    id: input.id ?? newId("design"),
    name: input.name?.trim() || "My new home",
    createdAt: now,
    updatedAt: now,
    revision: 0,
    plot: {
      width: input.width,
      length: input.length,
      unit: input.unit ?? "ft",
      roadSide: input.roadSide ?? "north",
      setbacks: input.setbacks ?? { front: 5, rear: 3, left: 3, right: 3 },
    },
    floors: Array.from({ length: input.floors ?? 1 }, (_, level) => ({ level, height: 10 })),
    parkingNeed: input.parkingNeed ?? "1-car",
    rooms: [],
    doors: [],
    windows: [],
    stairs: [],
    furniture: [],
    paint: [],
    flooring: {},
    compound: null,
    systems: { smartHome: false, security: false },
  });
}
export const floorBase = (design: HomeDesign, level: number) =>
  design.floors.filter((f) => f.level < level).reduce((sum, f) => sum + f.height, 0);
