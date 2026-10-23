import type { HomeDesign, Point, Rect, Side, Stair, StairType } from "../types/home";
import { EPS, contains, intersection, withinPlot } from "../lib/geometry";
import { stairSchema } from "./schemas";
import { issue, type Issue, type ValidationResult } from "./actions";

/** Headroom under the slab above: 6'8". */
export const HEADROOM_FT = 6 + 8 / 12;
/** Maximum riser, inches (NBC allows 7.5"; 7" is comfortable). */
export const MAX_RISER_IN = 7;

export type StairInfo = {
  label: string;
  /** Across the direction of travel. */
  width: number;
  /** Along the direction of travel. */
  length: number;
  minWidth: number;
  minLength: number;
  price: number;
  /** Half-turn stairs arrive at the end they start from. */
  halfTurn: boolean;
};
export const STAIR_TYPES: Record<StairType, StairInfo> = {
  straight: {
    label: "Straight",
    width: 3.5,
    length: 15,
    minWidth: 3,
    minLength: 9,
    price: 180000,
    halfTurn: false,
  },
  "l-shaped": {
    label: "L-shaped",
    width: 9,
    length: 13,
    minWidth: 6,
    minLength: 8,
    price: 220000,
    halfTurn: false,
  },
  "u-shaped": {
    label: "U-shaped",
    width: 8,
    length: 11,
    minWidth: 6.5,
    minLength: 8,
    price: 260000,
    halfTurn: true,
  },
  "dog-legged": {
    label: "Dog-legged",
    width: 7,
    length: 11,
    minWidth: 6,
    minLength: 8,
    price: 240000,
    halfTurn: true,
  },
  "open-newel": {
    label: "Open-newel",
    width: 9,
    length: 11,
    minWidth: 8,
    minLength: 8,
    price: 290000,
    halfTurn: true,
  },
  spiral: {
    label: "Spiral",
    width: 6,
    length: 6,
    minWidth: 5,
    minLength: 5,
    price: 210000,
    halfTurn: true,
  },
  helical: {
    label: "Helical",
    width: 9,
    length: 9,
    minWidth: 8,
    minLength: 8,
    price: 420000,
    halfTurn: true,
  },
  winder: {
    label: "Winder",
    width: 7,
    length: 12,
    minWidth: 6,
    minLength: 8,
    price: 230000,
    halfTurn: false,
  },
  cantilever: {
    label: "Cantilever",
    width: 3.5,
    length: 15,
    minWidth: 3,
    minLength: 9,
    price: 340000,
    halfTurn: false,
  },
  bifurcated: {
    label: "Bifurcated",
    width: 12,
    length: 12,
    minWidth: 12,
    minLength: 10,
    price: 480000,
    halfTurn: true,
  },
};

export type StairPart = {
  kind: "tread" | "landing";
  /** Polygon in plan, feet. */
  pts: Point[];
  /** Height of the walking surface above the floor the stair starts on. */
  z: number;
  flight: number;
};
export type StairGeometry = {
  parts: StairPart[];
  arrivals: Rect[];
  risers: number;
  riseIn: number;
};

const along = (d: Side) => d === "north" || d === "south";
/** Width across travel and length along travel, whatever the direction. */
export function stairDims(s: Pick<Stair, "width" | "length" | "direction">) {
  return along(s.direction)
    ? { across: s.width, run: s.length }
    : { across: s.length, run: s.width };
}

/**
 * Local frame: u runs across (0 = climber's left), v runs along the climb (0 = first
 * step). Turn "right" mirrors u, so the builders below only describe left turns.
 */
function toWorld(s: Stair, p: Point): Point {
  const { across } = stairDims(s),
    u = s.turn === "right" ? across - p.x : p.x,
    v = p.y;
  switch (s.direction) {
    case "north":
      return { x: s.x + u, y: s.y + s.length - v };
    case "south":
      return { x: s.x + s.width - u, y: s.y + v };
    case "east":
      return { x: s.x + v, y: s.y + u };
    case "west":
      return { x: s.x + s.width - v, y: s.y + s.length - u };
  }
}
const box = (u0: number, v0: number, u1: number, v1: number): Point[] => [
  { x: u0, y: v0 },
  { x: u1, y: v0 },
  { x: u1, y: v1 },
  { x: u0, y: v1 },
];
/** Split a box into n treads along u or v, climbing towards u1/v1 when ascending. */
function flight(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  n: number,
  axis: "u" | "v",
  ascending: boolean,
): Point[][] {
  const out: Point[][] = [];
  for (let i = 0; i < n; i++) {
    const a = ascending ? i / n : 1 - (i + 1) / n,
      b = ascending ? (i + 1) / n : 1 - i / n;
    out.push(
      axis === "v"
        ? box(u0, v0 + (v1 - v0) * a, u1, v0 + (v1 - v0) * b)
        : box(u0 + (u1 - u0) * a, v0, u0 + (u1 - u0) * b, v1),
    );
  }
  return out;
}
function wedge(c: Point, r0: number, r1: number, a0: number, a1: number): Point[] {
  const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 15)),
    rad = (a: number) => (a * Math.PI) / 180,
    arc = (r: number, rev: boolean) =>
      Array.from({ length: steps + 1 }, (_, i) => {
        const t = rev ? 1 - i / steps : i / steps,
          a = rad(a0 + (a1 - a0) * t);
        return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
      });
  return r0 < EPS ? [c, ...arc(r1, false)] : [...arc(r1, false), ...arc(r0, true)];
}

export function stairGeometry(s: Stair, rise: number): StairGeometry {
  const { across: W, run: L } = stairDims(s),
    risers = Math.max(2, Math.ceil((rise * 12) / MAX_RISER_IN)),
    step = rise / risers,
    parts: StairPart[] = [],
    arrivals: Point[][] = [];
  let level = 0;
  const treads = (polys: Point[][], f: number) =>
    polys.forEach((pts) => parts.push({ kind: "tread", pts, z: ++level * step, flight: f }));
  const landing = (pts: Point[], f: number) =>
    parts.push({ kind: "landing", pts, z: level * step, flight: f });
  const split = (a: number, b: number, total: number) => {
    const n1 = Math.max(1, Math.min(total - 1, Math.round((total * a) / (a + b))));
    return [n1, total - n1] as const;
  };
  const deep = (w: number) => Math.max(3, w);
  switch (s.stairType) {
    case "straight":
    case "cantilever":
      treads(flight(0, 0, W, L, risers, "v", true), 0);
      arrivals.push(box(0, L, W, L + deep(W)));
      break;
    case "l-shaped":
    case "winder": {
      const fw = Math.min(4, W / 2, L / 2),
        winders = s.stairType === "winder" ? 3 : 0,
        [n1, n2] = split(L - fw, W - fw, risers - winders);
      treads(flight(W - fw, 0, W, L - fw, n1, "v", true), 0);
      if (winders) {
        const i = { x: W - fw, y: L - fw };
        treads(
          [
            [i, { x: W, y: L - fw }, { x: W, y: L - fw / 3 }],
            [i, { x: W, y: L - fw / 3 }, { x: W, y: L }, { x: W - fw / 3, y: L }],
            [i, { x: W - fw / 3, y: L }, { x: W - fw, y: L }],
          ],
          1,
        );
      } else landing(box(W - fw, L - fw, W, L), 1);
      treads(flight(0, L - fw, W - fw, L, n2, "u", false), 2);
      arrivals.push(box(-deep(fw), L - fw, 0, L));
      break;
    }
    case "u-shaped":
    case "dog-legged": {
      const gap = s.stairType === "u-shaped" ? 0.5 : 0,
        fw = (W - gap) / 2,
        [n1, n2] = split(1, 1, risers);
      treads(flight(W - fw, 0, W, L - fw, n1, "v", true), 0);
      landing(box(0, L - fw, W, L), 1);
      treads(flight(0, 0, fw, L - fw, n2, "v", false), 2);
      arrivals.push(box(0, -deep(fw), fw, 0));
      break;
    }
    case "open-newel": {
      const fw = Math.min(4, (W - 1.5) / 2),
        mid = W - 2 * fw,
        midSteps = Math.max(1, Math.min(4, Math.round((mid * 12) / 11))),
        [n1, n2] = split(1, 1, risers - midSteps);
      treads(flight(W - fw, 0, W, L - fw, n1, "v", true), 0);
      landing(box(W - fw, L - fw, W, L), 1);
      treads(flight(fw, L - fw, W - fw, L, midSteps, "u", false), 2);
      landing(box(0, L - fw, fw, L), 3);
      treads(flight(0, 0, fw, L - fw, n2, "v", false), 4);
      arrivals.push(box(0, -deep(fw), fw, 0));
      break;
    }
    case "spiral": {
      const r = Math.min(W, L) / 2,
        c = { x: W / 2, y: L / 2 },
        n = risers - 1,
        sweep = 270 / n;
      // Treads turn left from the start edge; the top landing fills the last quadrant.
      for (let i = 0; i < n; i++) {
        const a0 = -90 + i * sweep;
        treads([wedge(c, 0.25, r, a0, a0 + sweep)], 0);
      }
      level++;
      landing(wedge(c, 0.25, r, 180, 270), 1);
      arrivals.push(box(c.x - r, c.y - r - deep(r), c.x, c.y - r));
      break;
    }
    case "helical": {
      const r = W / 2,
        ri = r * 0.35,
        c = { x: W / 2, y: L - r },
        sweep = 180 / risers;
      for (let i = 0; i < risers; i++) {
        const a0 = i * sweep;
        treads([wedge(c, ri, r, a0, a0 + sweep)], 0);
      }
      arrivals.push(box(0, c.y - deep(r - ri), r - ri, c.y));
      break;
    }
    case "bifurcated": {
      const side = W / 4,
        fw = Math.max(3, side),
        [n1, n2] = split(1, 1, risers);
      treads(flight(side, 0, W - side, L - fw, n1, "v", true), 0);
      landing(box(0, L - fw, W, L), 1);
      const base = level;
      treads(flight(0, 0, side, L - fw, n2, "v", false), 2);
      level = base;
      treads(flight(W - side, 0, W, L - fw, n2, "v", false), 3);
      arrivals.push(box(0, -deep(side), side, 0), box(W - side, -deep(side), W, 0));
      break;
    }
  }
  return {
    parts: parts.map((p) => ({ ...p, pts: p.pts.map((q) => toWorld(s, q)) })),
    arrivals: arrivals.map((pts) => boundsOf(pts.map((q) => toWorld(s, q)))),
    risers,
    riseIn: step * 12,
  };
}

export function boundsOf(pts: Point[]): Rect {
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, length: Math.max(...ys) - y };
}
const riseOf = (d: HomeDesign, s: Stair) => d.floors[s.fromFloor]?.height ?? 10;
export const stairParts = (d: HomeDesign, s: Stair) => stairGeometry(s, riseOf(d, s)).parts;
/** Every arrival rect on the upper floor. Half-turn stairs arrive where they start. */
export const arrivalsOf = (d: HomeDesign, s: Stair) => stairGeometry(s, riseOf(d, s)).arrivals;
export const arrivalOf = (d: HomeDesign, s: Stair) => arrivalsOf(d, s)[0]!;
/**
 * The hole cut in the slab above: every tread or landing a person stands on whose
 * headroom would otherwise hit the slab, i.e. higher than rise − 6'8".
 */
export function stairWell(d: HomeDesign, s: Stair): Rect | null {
  const rise = riseOf(d, s),
    high = stairParts(d, s).filter((p) => p.z > rise - HEADROOM_FT + EPS);
  if (!high.length) return null;
  return intersection(boundsOf(high.flatMap((p) => p.pts)), s);
}

export function validateStair(d: HomeDesign, s: Stair): ValidationResult {
  const parsed = stairSchema.safeParse(s);
  if (!parsed.success)
    return {
      ok: false,
      issues: [
        issue("stair/invalid", parsed.error.issues.map((x) => x.message).join("; "), [s.id]),
      ],
    };
  const issues: Issue[] = [],
    info = STAIR_TYPES[s.stairType],
    { across, run } = stairDims(s),
    name = `${info.label} stair`;
  if (s.toFloor !== s.fromFloor + 1 || !d.floors[s.toFloor])
    issues.push(
      issue("stair/no-floor-above", "A stair needs a floor directly above it. Add a floor first.", [
        s.id,
      ]),
    );
  if (across < info.minWidth - EPS || run < info.minLength - EPS)
    issues.push(
      issue(
        "stair/too-small",
        `${name} needs at least ${info.minWidth} × ${info.minLength} ft (across × along).`,
        [s.id],
      ),
    );
  if (!withinPlot(d.plot, s))
    issues.push(issue("stair/outside-plot", `${name} extends beyond the plot.`, [s.id]));
  if (!d.rooms.some((r) => r.floor === s.fromFloor && contains(r, s)))
    issues.push(
      issue("stair/outside-room", `${name} must sit wholly inside one room on its floor.`, [s.id]),
    );
  for (const o of d.stairs)
    if (o.id !== s.id && o.fromFloor === s.fromFloor && intersection(o, s))
      issues.push(issue("stair/overlap", `${name} overlaps another stair.`, [s.id, o.id]));
  return { ok: !issues.length, issues };
}

/**
 * The edges of a stairwell that need a balustrade upstairs: every side except where
 * the stair lets you off and where a wall already stands.
 */
export function wellGuards(d: HomeDesign, s: Stair): Rect[] {
  const well = stairWell(d, s);
  if (!well) return [];
  const arrivals = arrivalsOf(d, s),
    sides: [Side, Rect][] = [
      ["north", { x: well.x, y: well.y - 0.05, width: well.width, length: 0.1 }],
      ["south", { x: well.x, y: well.y + well.length - 0.05, width: well.width, length: 0.1 }],
      ["west", { x: well.x - 0.05, y: well.y, width: 0.1, length: well.length }],
      ["east", { x: well.x + well.width - 0.05, y: well.y, width: 0.1, length: well.length }],
    ];
  return sides
    .filter(([side, r]) => {
      const grown = { x: r.x - 0.2, y: r.y - 0.2, width: r.width + 0.4, length: r.length + 0.4 };
      if (arrivals.some((a) => intersection(a, grown))) return false;
      return !d.rooms.some(
        (rm) =>
          rm.floor === s.toFloor &&
          (side === "north"
            ? Math.abs(rm.y - well.y) < 0.3
            : side === "south"
              ? Math.abs(rm.y + rm.length - well.y - well.length) < 0.3
              : side === "west"
                ? Math.abs(rm.x - well.x) < 0.3
                : Math.abs(rm.x + rm.width - well.x - well.width) < 0.3),
      );
    })
    .map(([, r]) => r);
}
