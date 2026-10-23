import { z } from "zod";
import {
  ROOM_TYPES,
  DOOR_TYPE_IDS,
  WINDOW_TYPE_IDS,
  STAIR_TYPE_IDS,
  CATEGORIES,
  SHAPES,
  FLOORING_IDS,
  type HomeDesign,
} from "../types/home";
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const sideSchema = z.enum(["north", "east", "south", "west"]);
const num = z.number().finite();
const rect = { x: num.min(0), y: num.min(0), width: num.positive(), length: num.positive() };
export const roomSchema = z.object({
  ...rect,
  id: idSchema,
  name: z.string().trim().min(1).max(100),
  type: z.enum(ROOM_TYPES),
  floor: num.int().min(0).max(9),
  locked: z.boolean().optional(),
});
export const plotSchema = z.object({
  width: num.min(8).max(500),
  length: num.min(8).max(500),
  unit: z.enum(["ft", "m"]),
  roadSide: sideSchema,
  setbacks: z.object({ front: num.min(0), rear: num.min(0), left: num.min(0), right: num.min(0) }),
  polygon: z
    .array(z.object({ x: num.min(0), y: num.min(0) }))
    .min(3)
    .max(100)
    .optional(),
});
const opening = {
  id: idSchema,
  roomId: idSchema,
  side: sideSchema,
  offset: num,
  width: num.positive(),
  height: num.positive(),
};
export const doorSchema = z.object({
  ...opening,
  doorType: z.enum(DOOR_TYPE_IDS),
  swing: z.enum(["left", "right"]),
});
export const windowSchema = z.object({
  ...opening,
  windowType: z.enum(WINDOW_TYPE_IDS),
  sill: num.min(0),
});
export const stairSchema = z.object({
  ...rect,
  id: idSchema,
  fromFloor: num.int().min(0),
  toFloor: num.int().min(1),
  direction: sideSchema,
  stairType: z.enum(STAIR_TYPE_IDS),
  turn: z.enum(["left", "right"]),
});
export const pieceSchema = z.object({
  id: idSchema,
  catalogId: idSchema,
  roomId: idSchema,
  x: num,
  y: num,
  rotation: num,
  floor: num.int().min(0),
  locked: z.boolean().optional(),
});
export const itemSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(150),
  category: z.enum(CATEGORIES),
  width: num.positive().max(50),
  depth: num.positive().max(50),
  height: num.positive().max(50),
  price: num.min(0).max(1e9),
  suitableFor: z.array(z.enum(ROOM_TYPES)),
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
  shape: z.enum(SHAPES),
  mount: z.enum(["floor", "wall", "ceiling", "surface"]),
  clearanceFt: num.min(0).optional(),
  mountHeightFt: num.min(0).optional(),
  surfaceHeightFt: num.positive().max(50).optional(),
  model: z.string().startsWith("/models/").optional(),
  modelUrl: z
    .string()
    .regex(/^\/(models\/[A-Za-z0-9_\/-]+|api\/assets\/[A-Za-z0-9_-]+)\.glb$/)
    .optional(),
  sourceUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  meshJob: z
    .object({
      id: idSchema,
      status: z.enum(["pending", "ready", "failed"]),
      error: z.string().optional(),
    })
    .optional(),
});
export const gateSchema = z.object({
  side: sideSchema,
  offset: num,
  width: num.positive(),
  kind: z.enum(["sliding", "swing", "pedestrian"]),
});
export const compoundSchema = z.object({
  height: num.min(1).max(12),
  thickness: num.min(0.1).max(2),
  gate: gateSchema,
  pedestrianGate: gateSchema.optional(),
});
export const roofSchema = z.object({
  type: z.enum(["flat", "shed", "gable", "hip", "pyramid"]),
  materialId: idSchema,
  pitchDeg: num.min(5).max(55),
  overhangFt: num.min(0).max(5),
});
export const paintSchema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("room"), roomId: idSchema }),
    z.object({ kind: z.literal("wall"), roomId: idSchema, side: sideSchema }),
  ]),
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export const homeDesignSchema: z.ZodType<HomeDesign> = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(100),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    revision: num.int().min(0),
    plot: plotSchema,
    floors: z
      .array(z.object({ level: num.int().min(0), height: num.min(7).max(16) }))
      .min(1)
      .max(10),
    parkingNeed: z.enum(["none", "1-car", "2-car"]),
    rooms: z.array(roomSchema).max(500),
    doors: z.array(doorSchema).max(1000),
    windows: z.array(windowSchema).max(1000),
    stairs: z.array(stairSchema).max(100),
    furniture: z.array(pieceSchema).max(3000),
    paint: z.array(paintSchema).max(2500),
    flooring: z.record(idSchema, z.enum(FLOORING_IDS)),
    roof: roofSchema.nullable().optional(),
    compound: compoundSchema.nullable().optional(),
    systems: z.object({ smartHome: z.boolean(), security: z.boolean() }),
    customItems: z.array(itemSchema).max(200).optional(),
  })
  .strict();
