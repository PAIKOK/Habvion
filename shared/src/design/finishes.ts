import type {
  Compound,
  FlooringType,
  Gate,
  HomeDesign,
  PaintAssignment,
  Plot,
  Point,
  Room,
  RoomType,
  Side,
} from "../types/home";
import { EPS, edgeLength } from "../lib/geometry";
import { isOpenAir } from "./roomTypes";
import { issue, type Issue } from "./actions";

export const FLOORING_INFO: Record<
  FlooringType,
  { label: string; pricePerSqFt: number; color: string }
> = {
  concrete: { label: "Polished concrete", pricePerSqFt: 90, color: "#b9b4ab" },
  ceramic: { label: "Ceramic tile", pricePerSqFt: 80, color: "#e4ddd2" },
  vitrified: { label: "Vitrified tile", pricePerSqFt: 120, color: "#ece6dc" },
  porcelain: { label: "Porcelain tile", pricePerSqFt: 160, color: "#efeae3" },
  "anti-skid": { label: "Anti-skid tile", pricePerSqFt: 95, color: "#cfd4d2" },
  terrazzo: { label: "Terrazzo", pricePerSqFt: 180, color: "#ddd5c8" },
  mosaic: { label: "Mosaic", pricePerSqFt: 150, color: "#c9b9a0" },
  granite: { label: "Granite", pricePerSqFt: 220, color: "#6f6a66" },
  marble: { label: "Marble", pricePerSqFt: 300, color: "#f1ede6" },
  wood: { label: "Engineered wood", pricePerSqFt: 350, color: "#b88b5e" },
  laminate: { label: "Laminate", pricePerSqFt: 140, color: "#c49a6c" },
  vinyl: { label: "Vinyl", pricePerSqFt: 100, color: "#c8b9a3" },
  "outdoor-tile": { label: "Outdoor tile", pricePerSqFt: 110, color: "#b6a58e" },
  grass: { label: "Lawn", pricePerSqFt: 45, color: "#7fa25a" },
  gravel: { label: "Gravel", pricePerSqFt: 35, color: "#a9a194" },
};
/** What a room is floored with when the design does not say. */
export function defaultFlooring(type: RoomType): FlooringType {
  if (type === "garden") return "grass";
  if (type === "parking" || type === "garage") return "concrete";
  if (isOpenAir(type)) return "outdoor-tile";
  if (["bathroom", "attached-bathroom", "powder", "laundry", "utility"].includes(type))
    return "anti-skid";
  if (type === "pooja") return "marble";
  if (type.includes("bedroom") || type === "study" || type === "home-office") return "laminate";
  return "vitrified";
}
export const flooringOf = (d: HomeDesign, r: Room) => d.flooring[r.id] ?? defaultFlooring(r.type);

export const PAINT_SWATCHES = [
  { name: "Ivory", hex: "#f4efe4" },
  { name: "Chalk white", hex: "#f7f6f2" },
  { name: "Warm sand", hex: "#e8d9bf" },
  { name: "Terracotta", hex: "#c8714f" },
  { name: "Haldi", hex: "#e3b23c" },
  { name: "Sage", hex: "#b7c4a4" },
  { name: "Peacock", hex: "#2f6f73" },
  { name: "Indigo", hex: "#3d4f7d" },
  { name: "Blush", hex: "#e7c3b5" },
  { name: "Mist grey", hex: "#cfd2d0" },
  { name: "Charcoal", hex: "#4a4a48" },
  { name: "Mint", hex: "#cfe5d6" },
];
export const DEFAULT_WALL = "#f4efe4";
/** Paint on one wall face: a wall-specific coat wins over the room's coat. */
export function wallColor(d: HomeDesign, roomId: string, side: Side) {
  const wall = d.paint.find(
    (p) => p.target.kind === "wall" && p.target.roomId === roomId && p.target.side === side,
  );
  const room = d.paint.find((p) => p.target.kind === "room" && p.target.roomId === roomId);
  return wall?.colorHex ?? room?.colorHex ?? DEFAULT_WALL;
}
export const sameTarget = (a: PaintAssignment["target"], b: PaintAssignment["target"]) =>
  a.kind === b.kind &&
  a.roomId === b.roomId &&
  (a.kind === "room" || a.side === (b as typeof a).side);

export const ROOF_MATERIALS: Record<
  string,
  { label: string; pricePerSqFt: number; color: string; pitched: boolean }
> = {
  rcc: {
    label: "RCC slab with waterproofing",
    pricePerSqFt: 260,
    color: "#bdb7ad",
    pitched: false,
  },
  "clay-tile": { label: "Mangalore clay tile", pricePerSqFt: 320, color: "#b5583a", pitched: true },
  "metal-sheet": {
    label: "Standing-seam metal",
    pricePerSqFt: 240,
    color: "#5f6b73",
    pitched: true,
  },
  shingle: { label: "Asphalt shingle", pricePerSqFt: 280, color: "#4f4a47", pitched: true },
  slate: { label: "Slate", pricePerSqFt: 450, color: "#3f4549", pitched: true },
};

/** A gate is centred `offset` feet from the north or west end of its plot side. */
export function gateSpan(plot: Plot, g: Gate) {
  return {
    start: g.offset - g.width / 2,
    end: g.offset + g.width / 2,
    length: edgeLength({ x: 0, y: 0, width: plot.width, length: plot.length }, g.side),
  };
}
export function validateCompound(d: HomeDesign, c: Compound): Issue[] {
  const issues: Issue[] = [],
    gates = [c.gate, ...(c.pedestrianGate ? [c.pedestrianGate] : [])];
  for (const g of gates) {
    const s = gateSpan(d.plot, g);
    if (s.start < 0.5 - EPS || s.end > s.length - 0.5 + EPS)
      issues.push(
        issue(
          "compound/gate-outside",
          `The ${g.kind} gate does not fit on the ${g.side} boundary.`,
        ),
      );
    if (g.kind === "pedestrian" ? g.width < 3 - EPS : g.width < 8 - EPS)
      issues.push(
        issue(
          "compound/gate-narrow",
          g.kind === "pedestrian"
            ? "A pedestrian gate needs at least 3 ft."
            : "A vehicle gate needs at least 8 ft.",
        ),
      );
  }
  if (c.pedestrianGate && c.pedestrianGate.side === c.gate.side) {
    const a = gateSpan(d.plot, c.gate),
      b = gateSpan(d.plot, c.pedestrianGate);
    if (a.start < b.end + 1 && b.start < a.end + 1)
      issues.push(
        issue("compound/gates-overlap", "Leave at least 1 ft of wall between the two gates."),
      );
  }
  if (c.gate.side !== d.plot.roadSide)
    issues.push(
      issue(
        "compound/gate-off-road",
        "The main gate is not on the road side.",
        undefined,
        "warning",
      ),
    );
  return issues;
}
/** Boundary wall runs with the gate gaps cut out, as [a, b] segments in plan. */
export function compoundSegments(plot: Plot, c: Compound): [Point, Point][] {
  const out: [Point, Point][] = [];
  const sides: [Side, Point, Point][] = [
    ["north", { x: 0, y: 0 }, { x: plot.width, y: 0 }],
    ["east", { x: plot.width, y: 0 }, { x: plot.width, y: plot.length }],
    ["south", { x: 0, y: plot.length }, { x: plot.width, y: plot.length }],
    ["west", { x: 0, y: 0 }, { x: 0, y: plot.length }],
  ];
  const gates = [c.gate, ...(c.pedestrianGate ? [c.pedestrianGate] : [])];
  for (const [side, a, b] of sides) {
    const len = Math.hypot(b.x - a.x, b.y - a.y),
      cuts = gates
        .filter((g) => g.side === side)
        .map((g) => [g.offset - g.width / 2, g.offset + g.width / 2] as const)
        .sort((p, q) => p[0] - q[0]);
    let t = 0;
    const at = (u: number): Point => ({
      x: a.x + ((b.x - a.x) * u) / len,
      y: a.y + ((b.y - a.y) * u) / len,
    });
    for (const [s, e] of cuts) {
      if (s > t + EPS) out.push([at(t), at(s)]);
      t = Math.max(t, e);
    }
    if (t < len - EPS) out.push([at(t), at(len)]);
  }
  return out;
}
export function defaultCompound(plot: Plot): Compound {
  const len = plot.roadSide === "north" || plot.roadSide === "south" ? plot.width : plot.length;
  return {
    height: 5,
    thickness: 0.75,
    gate: {
      side: plot.roadSide,
      offset: Math.max(5, Math.min(len - 5, len * 0.3)),
      width: 10,
      kind: "sliding",
    },
    pedestrianGate: {
      side: plot.roadSide,
      offset: Math.min(len - 3, len * 0.3 + 9),
      width: 3.5,
      kind: "pedestrian",
    },
  };
}
