import type { HomeDesign, Plot, Room, Door, WindowOpening, Stair, PlacedFurniture } from "../types/home";
import type { PaintAssignment, FlooringType, Roof, Compound, FurnitureItem } from "../types/home";
export type DesignAction =
  | { type: "design/rename"; name: string }
  | { type: "plot/update"; patch: Partial<Plot> }
  | { type: "floors/count"; count: number }
  | { type: "floor/height"; level: number; height: number }
  | { type: "room/add"; room: Room }
  | { type: "room/update"; id: string; patch: Partial<Omit<Room, "id">> }
  | { type: "room/delete"; id: string }
  | { type: "room/duplicate"; id: string; newId: string; dx: number; dy: number }
  | { type: "door/add"; door: Door }
  | { type: "door/update"; id: string; patch: Partial<Omit<Door, "id">> }
  | { type: "door/delete"; id: string }
  | { type: "window/add"; window: WindowOpening }
  | { type: "window/update"; id: string; patch: Partial<Omit<WindowOpening, "id">> }
  | { type: "window/delete"; id: string }
  | { type: "stair/add"; stair: Stair }
  | { type: "stair/update"; id: string; patch: Partial<Omit<Stair, "id">> }
  | { type: "stair/delete"; id: string }
  | { type: "furniture/add"; piece: PlacedFurniture }
  | { type: "furniture/update"; id: string; patch: Partial<Omit<PlacedFurniture, "id">> }
  | { type: "furniture/delete"; id: string }
  | { type: "paint/set"; target: PaintAssignment["target"]; colorHex: string }
  | { type: "paint/clear"; target: PaintAssignment["target"] }
  | { type: "flooring/set"; roomId: string; flooring: FlooringType | null }
  | { type: "roof/set"; roof: Roof | null }
  | { type: "compound/set"; compound: Compound | null }
  | { type: "systems/set"; patch: Partial<HomeDesign["systems"]> }
  | { type: "parking/need"; need: HomeDesign["parkingNeed"] }
  | { type: "custom-item/add"; item: FurnitureItem }
  | { type: "custom-item/remove"; id: string }
  | { type: "custom-item/set-model"; id: string; patch: { modelUrl?: string | null; meshJob?: FurnitureItem["meshJob"] | null } };
export type Issue = {
  level: "error" | "warning";
  code: string;
  message: string;
  entityIds?: string[];
  floor?: number;
};
export type ValidationResult = { ok: boolean; issues: Issue[] };
export type ApplyResult = ValidationResult & { applied: boolean; design: HomeDesign };
export const issue = (
  code: string,
  message: string,
  ids?: string[],
  level: Issue["level"] = "error",
): Issue => ({ code, message, level, entityIds: ids });
