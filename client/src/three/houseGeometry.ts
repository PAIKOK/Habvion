import type { Door, HomeDesign, Point, Rect, Room, WindowOpening } from "@shared/types/home";
import { deriveWalls, openingLine, wallPanels, type Wall } from "@shared/design/walls";
import { stairWell, stairParts, wellGuards } from "@shared/design/stairs";
import { isOpenAir } from "@shared/design/roomTypes";
import { FLOORING_INFO, ROOF_MATERIALS, compoundSegments, flooringOf, wallColor } from "@shared/design/finishes";
import { EPS, intersection, subtractAll } from "@shared/lib/geometry";

/**
 * Plan (x east, y south, feet) maps to three as X = x, Z = y, Y up. Everything here is
 * derived from the design on every render; nothing is stored.
 */
export { PLINTH, SLAB, elevation, roomFloorY } from "@shared/design/levels";
import { SLAB, elevation, roomFloorY } from "@shared/design/levels";

export type Block = {
  key: string;
  /** Centre. */
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  /** Per-face colours in BoxGeometry order: +x, -x, +y, -y, +z, -z. */
  faces?: string[];
  glass?: boolean;
  metal?: boolean;
  wall?: boolean;
  floor?: number;
};
const box = (key: string, r: Rect, y0: number, y1: number, color: string, extra: Partial<Block> = {}): Block => ({
  key,
  pos: [r.x + r.width / 2, (y0 + y1) / 2, r.y + r.length / 2],
  size: [Math.max(r.width, 0.01), Math.max(y1 - y0, 0.01), Math.max(r.length, 0.01)],
  color,
  ...extra,
});

export function slabs(d: HomeDesign): Block[] {
  const out: Block[] = [];
  for (const r of d.rooms) {
    const wells = d.stairs
      .filter((s) => s.toFloor === r.floor)
      .map((s) => stairWell(d, s))
      .filter((w): w is Rect => !!w),
      top = roomFloorY(d, r),
      color = FLOORING_INFO[flooringOf(d, r)].color,
      bottom = r.floor === 0 ? 0 : top - SLAB;
    // Finish on top, plaster ceiling underneath, concrete edges.
    const faces = ["#cfc8bc", "#cfc8bc", color, "#f3f0ea", "#cfc8bc", "#cfc8bc"];
    subtractAll(r, wells).forEach((p, i) =>
      out.push(box(`slab-${r.id}-${i}`, p, bottom, top, color, { floor: r.floor, faces })),
    );
  }
  // Ceilings: wherever an enclosed room has nothing above it, it needs a roof slab.
  for (const r of d.rooms.filter((r) => !isOpenAir(r.type))) {
    const above = d.rooms.filter((o) => o.floor === r.floor + 1).map((o) => intersection(o, r)).filter((x): x is Rect => !!x),
      top = elevation(d, r.floor) + d.floors[r.floor]!.height;
    subtractAll(r, above).forEach((p, i) =>
      out.push(
        box(`ceil-${r.id}-${i}`, p, top - SLAB, top, "#d8d2c8", {
          floor: r.floor,
          faces: ["#cfc8bc", "#cfc8bc", "#d8d2c8", "#f3f0ea", "#cfc8bc", "#cfc8bc"],
        }),
      ),
    );
  }
  return out;
}

/** Which way a wall's faces point, and which room's paint goes on each. */
function wallFaces(d: HomeDesign, w: Wall, horizontal: boolean) {
  const exterior = "#efe8dc",
    plus = w.owners.find((o) => (horizontal ? o.side === "north" : o.side === "west")),
    minus = w.owners.find((o) => (horizontal ? o.side === "south" : o.side === "east")),
    paint = (o?: { roomId: string; side: "north" | "south" | "east" | "west" }) => {
      if (!o) return exterior;
      const r = d.rooms.find((x) => x.id === o.roomId);
      return r && isOpenAir(r.type) ? exterior : wallColor(d, o.roomId, o.side);
    },
    p = paint(plus),
    m = paint(minus),
    edge = "#e7e0d4";
  // +x, -x, +y, -y, +z, -z
  return horizontal ? [edge, edge, edge, edge, p, m] : [p, m, edge, edge, edge, edge];
}
export function walls(d: HomeDesign): Block[] {
  const out: Block[] = [];
  for (const w of deriveWalls(d)) {
    const h = Math.abs(w.a.y - w.b.y) < EPS,
      base = elevation(d, w.floor),
      start = h ? w.a.x : w.a.y,
      len = h ? w.b.x - w.a.x : w.b.y - w.a.y,
      t = w.thickness;
    if (w.open) {
      // Parapet as a balustrade: a low solid upstand, glass above, a steel handrail.
      const rect = (a: number, b: number): Rect =>
        h ? { x: a, y: w.a.y - t / 2, width: b - a, length: t } : { x: w.a.x - t / 2, y: a, width: t, length: b - a };
      out.push(box(`up-${w.id}`, rect(start, start + len), base, base + 0.6, "#e7e0d4", { floor: w.floor }));
      out.push(box(`gl-${w.id}`, rect(start, start + len), base + 0.6, base + w.height - 0.15, "#bcd6dc", { glass: true, floor: w.floor }));
      out.push(box(`rail-${w.id}`, rect(start, start + len), base + w.height - 0.15, base + w.height, "#6d7175", { metal: true, floor: w.floor }));
      continue;
    }
    const faces = wallFaces(d, w, h);
    wallPanels(d, w).forEach((p, i) => {
      // Close the corners: the first and last panels run half a thickness past the ends.
      const a = start + p.along - (p.along < EPS ? t / 2 : 0),
        b = start + p.along + p.width + (Math.abs(p.along + p.width - len) < EPS ? t / 2 : 0),
        r: Rect = h ? { x: a, y: w.a.y - t / 2, width: b - a, length: t } : { x: w.a.x - t / 2, y: a, width: t, length: b - a };
      out.push(box(`w-${w.id}-${i}`, r, base + p.bottom, base + p.bottom + p.height, faces[4]!, { faces, wall: true, floor: w.floor }));
    });
  }
  return out;
}

/** Door and window frames, leaves and glass, set in the middle of the wall. */
export function joinery(d: HomeDesign): Block[] {
  const out: Block[] = [],
    walls = deriveWalls(d);
  const thicknessAt = (o: Door | WindowOpening) => {
    const p = openingLine(d, o)!;
    const w = walls.find(
      (w) =>
        w.floor === p.floor &&
        Math.abs((p.horizontal ? w.a.y : w.a.x) - p.line) < EPS &&
        (p.horizontal ? Math.abs(w.a.y - w.b.y) < EPS : Math.abs(w.a.x - w.b.x) < EPS) &&
        (p.horizontal ? w.a.x : w.a.y) <= p.start + EPS &&
        (p.horizontal ? w.b.x : w.b.y) >= p.end - EPS,
    );
    return w?.thickness ?? 0.33;
  };
  const piece = (key: string, o: Door | WindowOpening, a: number, b: number, y0: number, y1: number, depth: number, color: string, extra: Partial<Block> = {}) => {
    const p = openingLine(d, o)!,
      r: Rect = p.horizontal
        ? { x: p.start + a, y: p.line - depth / 2, width: b - a, length: depth }
        : { x: p.line - depth / 2, y: p.start + a, width: depth, length: b - a };
    out.push(box(key, r, y0, y1, color, { floor: p.floor, ...extra }));
  };
  for (const o of d.doors) {
    const p = openingLine(d, o);
    if (!p) continue;
    const base = elevation(d, p.floor),
      t = thicknessAt(o) + 0.04,
      f = 0.18,
      wood = o.doorType === "flush" ? "#a98764" : "#7b5a3c";
    piece(`df-l-${o.id}`, o, 0, f, base, base + o.height, t, "#e9e2d6");
    piece(`df-r-${o.id}`, o, o.width - f, o.width, base, base + o.height, t, "#e9e2d6");
    piece(`df-t-${o.id}`, o, 0, o.width, base + o.height - f, base + o.height, t, "#e9e2d6");
    if (o.doorType === "sliding" || o.doorType === "french") {
      piece(`dl-a-${o.id}`, o, f, o.width / 2, base, base + o.height - f, 0.12, "#bcd6dc", { glass: true });
      piece(`dl-b-${o.id}`, o, o.width / 2, o.width - f, base, base + o.height - f, 0.12, "#bcd6dc", { glass: true });
      piece(`dm-${o.id}`, o, o.width / 2 - 0.05, o.width / 2 + 0.05, base, base + o.height - f, 0.16, "#5f5a52");
    } else piece(`dl-${o.id}`, o, f, o.width - f, base, base + o.height - f, 0.15, wood);
  }
  for (const o of d.windows) {
    const p = openingLine(d, o);
    if (!p) continue;
    const base = elevation(d, p.floor) + o.sill,
      t = thicknessAt(o) + 0.04,
      f = 0.15;
    piece(`wf-b-${o.id}`, o, -0.15, o.width + 0.15, base - 0.12, base, t + 0.25, "#d9d2c6");
    piece(`wf-t-${o.id}`, o, 0, o.width, base + o.height - f, base + o.height, t, "#f2eee7");
    piece(`wf-l-${o.id}`, o, 0, f, base, base + o.height, t, "#f2eee7");
    piece(`wf-r-${o.id}`, o, o.width - f, o.width, base, base + o.height, t, "#f2eee7");
    if (o.width > 2.5) piece(`wm-${o.id}`, o, o.width / 2 - 0.05, o.width / 2 + 0.05, base, base + o.height, 0.12, "#f2eee7");
    piece(`wg-${o.id}`, o, f, o.width - f, base, base + o.height - f, 0.05, "#a9cbd4", { glass: true });
  }
  return out;
}

export type Tread = { key: string; pts: Point[]; top: number; depth: number; floor: number; color: string };
export function stairs(d: HomeDesign): { treads: Tread[]; rails: Block[] } {
  const treads: Tread[] = [],
    rails: Block[] = [];
  for (const s of d.stairs) {
    const base = elevation(d, s.fromFloor),
      cantilever = s.stairType === "cantilever";
    stairParts(d, s).forEach((p, i) =>
      treads.push({
        key: `t-${s.id}-${i}`,
        pts: p.pts,
        top: base + p.z,
        depth: cantilever ? 0.25 : p.kind === "landing" ? 0.6 : 0.5,
        floor: s.fromFloor,
        color: cantilever ? "#9b7652" : p.kind === "landing" ? "#d3cbbd" : "#e3dccf",
      }),
    );
    // A balustrade round the well upstairs, open only where you step off.
    const top = elevation(d, s.toFloor);
    wellGuards(d, s).forEach((r, k) => {
      rails.push(box(`wr-g-${s.id}-${k}`, r, top, top + 3.2, "#bcd6dc", { glass: true, floor: s.toFloor }));
      rails.push(box(`wr-r-${s.id}-${k}`, r, top + 3.2, top + 3.35, "#6d7175", { metal: true, floor: s.toFloor }));
    });
  }
  return { treads, rails };
}

/** Parapets round flat roofs and open terraces on top of whatever has nothing above. */
export function roofEdges(d: HomeDesign): Block[] {
  const out: Block[] = [],
    top = d.floors.length - 1,
    flatTop = !d.roof || d.roof.type === "flat";
  for (const w of deriveWalls(d)) {
    if (!w.exterior || w.open) continue;
    const owner = d.rooms.find((r) => r.id === w.owners[0]!.roomId)!,
      covered = d.rooms.some((o) => o.floor === w.floor + 1 && intersection(o, { x: Math.min(w.a.x, w.b.x) - 0.3, y: Math.min(w.a.y, w.b.y) - 0.3, width: Math.abs(w.b.x - w.a.x) + 0.6, length: Math.abs(w.b.y - w.a.y) + 0.6 }) && intersection(o, owner));
    if (covered || (w.floor === top && !flatTop)) continue;
    const y = elevation(d, w.floor) + d.floors[w.floor]!.height,
      h = Math.abs(w.a.y - w.b.y) < EPS,
      t = w.thickness,
      r: Rect = h ? { x: w.a.x - t / 2, y: w.a.y - t / 2, width: w.b.x - w.a.x + t, length: t } : { x: w.a.x - t / 2, y: w.a.y - t / 2, width: t, length: w.b.y - w.a.y + t };
    out.push(box(`par-${w.id}`, r, y, y + (w.floor === top && d.roof ? 1.5 : 3.5), "#e7e0d4", { floor: w.floor, key: `par-${w.id}` }));
  }
  return out;
}

export type RoofMesh = { positions: number[]; color: string };
/** A pitched roof over the top floor's enclosed footprint (its bounding box). */
export function pitchedRoof(d: HomeDesign): RoofMesh | null {
  const roof = d.roof;
  if (!roof || roof.type === "flat") return null;
  const top = d.floors.length - 1,
    rooms = d.rooms.filter((r) => r.floor === top && !isOpenAir(r.type));
  if (!rooms.length) return null;
  const o = roof.overhangFt,
    x0 = Math.min(...rooms.map((r) => r.x)) - o,
    z0 = Math.min(...rooms.map((r) => r.y)) - o,
    x1 = Math.max(...rooms.map((r) => r.x + r.width)) + o,
    z1 = Math.max(...rooms.map((r) => r.y + r.length)) + o,
    y = elevation(d, top) + d.floors[top]!.height,
    tan = Math.tan((roof.pitchDeg * Math.PI) / 180),
    W = x1 - x0,
    L = z1 - z0,
    alongX = W >= L,
    half = (alongX ? L : W) / 2,
    ridge = y + half * tan,
    P: number[] = [],
    tri = (a: number[], b: number[], c: number[]) => P.push(...a, ...b, ...c),
    quad = (a: number[], b: number[], c: number[], e: number[]) => {
      tri(a, b, c);
      tri(a, c, e);
    };
  const A = [x0, y, z0],
    B = [x1, y, z0],
    C = [x1, y, z1],
    D = [x0, y, z1];
  if (roof.type === "shed") {
    // Mono-pitch: low at the south (or east) eave, high at the north (or west) wall.
    const hi = y + (alongX ? L : W) * tan;
    if (alongX) {
      const A2 = [x0, hi, z0],
        B2 = [x1, hi, z0];
      quad(D, C, B2, A2);
      tri(A, D, A2);
      tri(B, B2, C);
      quad(A, A2, B2, B);
    } else {
      const A2 = [x0, hi, z0],
        D2 = [x0, hi, z1];
      quad(B, C, D2, A2);
      tri(A, A2, B);
      tri(D, C, D2);
      quad(A, D, D2, A2);
    }
  } else if (roof.type === "gable") {
    if (alongX) {
      const R1 = [x0, ridge, z0 + half],
        R2 = [x1, ridge, z0 + half];
      quad(A, R1, R2, B);
      quad(D, C, R2, R1);
      tri(A, D, R1);
      tri(B, R2, C);
    } else {
      const R1 = [x0 + half, ridge, z0],
        R2 = [x0 + half, ridge, z1];
      quad(A, R1, R2, D);
      quad(B, C, R2, R1);
      tri(A, B, R1);
      tri(D, R2, C);
    }
  } else {
    const inset = roof.type === "pyramid" ? Math.min(W, L) / 2 : half,
      R1 = alongX ? [x0 + inset, ridge, z0 + half] : [x0 + half, ridge, z0 + inset],
      R2 = alongX ? [x1 - inset, ridge, z0 + half] : [x0 + half, ridge, z1 - inset];
    if (alongX) {
      quad(A, R1, R2, B);
      quad(D, C, R2, R1);
      tri(A, D, R1);
      tri(B, R2, C);
    } else {
      quad(A, R1, R2, D);
      quad(B, C, R2, R1);
      tri(A, B, R1);
      tri(D, R2, C);
    }
  }
  return { positions: P, color: (ROOF_MATERIALS[roof.materialId] ?? ROOF_MATERIALS["clay-tile"]!).color };
}

export function compound(d: HomeDesign): Block[] {
  const c = d.compound;
  if (!c) return [];
  const out: Block[] = [];
  compoundSegments(d.plot, c).forEach(([a, b], i) => {
    const h = Math.abs(a.y - b.y) < EPS,
      t = c.thickness,
      r: Rect = h ? { x: Math.min(a.x, b.x), y: a.y - t / 2, width: Math.abs(b.x - a.x), length: t } : { x: a.x - t / 2, y: Math.min(a.y, b.y), width: t, length: Math.abs(b.y - a.y) };
    out.push(box(`cw-${i}`, r, 0, c.height, "#d9cfbf"));
    out.push(box(`cc-${i}`, { x: r.x - 0.05, y: r.y - 0.05, width: r.width + 0.1, length: r.length + 0.1 }, c.height, c.height + 0.2, "#bfb3a0"));
  });
  for (const g of [c.gate, ...(c.pedestrianGate ? [c.pedestrianGate] : [])]) {
    const h = g.side === "north" || g.side === "south",
      line = g.side === "north" ? 0 : g.side === "south" ? d.plot.length : g.side === "west" ? 0 : d.plot.width,
      s = g.offset - g.width / 2,
      height = Math.min(c.height + 0.5, 6),
      bars = Math.max(3, Math.round(g.width / 0.5));
    for (let i = 0; i <= bars; i++) {
      const u = s + 0.15 + ((g.width - 0.3) * i) / bars,
        r: Rect = h ? { x: u - 0.04, y: line - 0.04, width: 0.08, length: 0.08 } : { x: line - 0.04, y: u - 0.04, width: 0.08, length: 0.08 };
      out.push(box(`gb-${g.kind}-${i}`, r, 0.3, height, "#2f3337", { metal: true }));
    }
    for (const y of [0.3, height / 2, height]) {
      const r: Rect = h ? { x: s + 0.1, y: line - 0.06, width: g.width - 0.2, length: 0.12 } : { x: line - 0.06, y: s + 0.1, width: 0.12, length: g.width - 0.2 };
      out.push(box(`gr-${g.kind}-${y}`, r, y - 0.08, y + 0.08, "#2f3337", { metal: true }));
    }
  }
  return out;
}
