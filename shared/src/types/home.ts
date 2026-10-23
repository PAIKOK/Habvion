/** FEET ONLY. Origin NW; x east, y south. Rotation 0 faces south; +90 faces west. */
export type Unit = "ft" | "m";
export type Side = "north" | "east" | "south" | "west";
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; length: number };
export type Plot = {
  width: number;
  length: number;
  unit: Unit;
  roadSide: Side;
  setbacks: { front: number; rear: number; left: number; right: number };
  polygon?: Point[];
};
export type Floor = { level: number; height: number };
export const ROOM_TYPES = [
  "bedroom",
  "master-bedroom",
  "guest-bedroom",
  "kids-bedroom",
  "servant",
  "living",
  "family",
  "dining",
  "hall",
  "foyer",
  "bathroom",
  "attached-bathroom",
  "powder",
  "kitchen",
  "pantry",
  "laundry",
  "utility",
  "study",
  "home-office",
  "home-theatre",
  "gym",
  "hobby",
  "pooja",
  "dressing",
  "walk-in-wardrobe",
  "store",
  "balcony",
  "terrace",
  "courtyard",
  "garden",
  "parking",
  "garage",
  "porch",
  "staircase",
  "other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export type Room = Rect & {
  id: string;
  name: string;
  type: RoomType;
  floor: number;
  locked?: boolean;
};
export const DOOR_TYPE_IDS = [
  "panel",
  "flush",
  "sliding",
  "french",
  "barn",
  "bifold",
  "louvered",
  "pivot",
] as const;
export type DoorType = (typeof DOOR_TYPE_IDS)[number];
export const WINDOW_TYPE_IDS = [
  "single-hung",
  "double-hung",
  "casement",
  "sliding",
  "awning",
  "picture",
  "bay",
] as const;
export type WindowType = (typeof WINDOW_TYPE_IDS)[number];
export type Opening = {
  id: string;
  roomId: string;
  side: Side;
  offset: number;
  width: number;
  height: number;
};
export type Door = Opening & { doorType: DoorType; swing: "left" | "right" };
export type WindowOpening = Opening & { windowType: WindowType; sill: number };
export const STAIR_TYPE_IDS = [
  "straight",
  "l-shaped",
  "u-shaped",
  "dog-legged",
  "open-newel",
  "spiral",
  "helical",
  "winder",
  "cantilever",
  "bifurcated",
] as const;
export type StairType = (typeof STAIR_TYPE_IDS)[number];
export type Stair = Rect & {
  id: string;
  fromFloor: number;
  toFloor: number;
  direction: Side;
  stairType: StairType;
  turn: "left" | "right";
};
export const CATEGORIES = [
  "seating",
  "tables",
  "beds",
  "storage",
  "kitchen",
  "bathroom",
  "appliances",
  "lighting",
  "decor",
  "outdoor",
  "vehicles",
  "surface",
] as const;
export type FurnitureCategory = (typeof CATEGORIES)[number];
export const SHAPES = [
  "sofa",
  "chair",
  "armchair",
  "diwan",
  "swing",
  "table",
  "desk",
  "bed",
  "wardrobe",
  "cabinet",
  "shelf",
  "counter",
  "sink",
  "hob",
  "chimney",
  "wc",
  "basin",
  "shower",
  "bath",
  "appliance",
  "fridge",
  "washer",
  "fan",
  "ac",
  "lamp",
  "sconce",
  "pendant",
  "plant",
  "tree",
  "car",
  "bike",
  "rug",
  "mirror",
  "curtain",
  "art",
  "mandir",
  "tank",
  "solar",
  "pergola",
  "small",
  "box",
] as const;
export type FurnitureShape = (typeof SHAPES)[number];
export type FurnitureItem = {
  id: string;
  name: string;
  category: FurnitureCategory;
  width: number;
  depth: number;
  height: number;
  price: number;
  suitableFor: RoomType[];
  colorHex: string;
  shape: FurnitureShape;
  mount: "floor" | "wall" | "ceiling" | "surface";
  clearanceFt?: number;
  mountHeightFt?: number;
  /** Usable surface height; overall height includes headboards and mirrors. */
  surfaceHeightFt?: number;
  model?: string;
  modelUrl?: string;
  sourceUrl?: string;
  imageUrl?: string;
  meshJob?: { id: string; status: "pending" | "ready" | "failed"; error?: string };
};
/** x/y is the centre of the footprint; rotation is clockwise degrees (0 faces south). */
export type PlacedFurniture = Point & {
  id: string;
  catalogId: string;
  roomId: string;
  rotation: number;
  floor: number;
  locked?: boolean;
};
export type PaintAssignment = {
  target: { kind: "room"; roomId: string } | { kind: "wall"; roomId: string; side: Side };
  colorHex: string;
};
export const FLOORING_IDS = [
  "concrete",
  "ceramic",
  "vitrified",
  "porcelain",
  "anti-skid",
  "terrazzo",
  "mosaic",
  "granite",
  "marble",
  "wood",
  "laminate",
  "vinyl",
  "outdoor-tile",
  "grass",
  "gravel",
] as const;
export type FlooringType = (typeof FLOORING_IDS)[number];
export type Roof = {
  type: "flat" | "shed" | "gable" | "hip" | "pyramid";
  materialId: string;
  pitchDeg: number;
  overhangFt: number;
};
export type Gate = {
  side: Side;
  offset: number;
  width: number;
  kind: "sliding" | "swing" | "pedestrian";
};
export type Compound = { height: number; thickness: number; gate: Gate; pedestrianGate?: Gate };
export type HomeDesign = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  plot: Plot;
  floors: Floor[];
  parkingNeed: "none" | "1-car" | "2-car";
  rooms: Room[];
  doors: Door[];
  windows: WindowOpening[];
  stairs: Stair[];
  furniture: PlacedFurniture[];
  paint: PaintAssignment[];
  flooring: Record<string, FlooringType>;
  roof?: Roof | null;
  compound?: Compound | null;
  systems: { smartHome: boolean; security: boolean };
  customItems?: FurnitureItem[];
};
// Deliberately NO walls field. Every wall is derived from room edges.
