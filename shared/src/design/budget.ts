import type { HomeDesign, Room } from "../types/home";
import { DOOR_TYPES, WINDOW_TYPES } from "./openingTypes";
import { STAIR_TYPES } from "./stairs";
import { itemFor } from "./catalog";
import { FLOORING_INFO, ROOF_MATERIALS, compoundSegments, flooringOf } from "./finishes";
import { deriveWalls } from "./walls";
import { isOpenAir } from "./roomTypes";
import { indianGroup, inr } from "../lib/units";

/** Indicative 2026 rates in rupees. Every figure here is a rate, never a total. */
export const RATES = {
  structurePerSqFt: 1900,
  openAirStructurePerSqFt: 900,
  foundationPerSqFt: 260,
  electricalPlumbingPerSqFt: 260,
  wetRoomFixturesEach: 45000,
  interiorPaintPerSqFt: 28,
  exteriorPaintPerSqFt: 38,
  compoundWallPerSqFt: 450,
  gate: { sliding: 85000, swing: 60000, pedestrian: 25000 },
  smartHomeBase: 150000,
  smartHomePerSqFt: 150,
  securityBase: 85000,
  securityPerFloor: 6000,
  contingency: 0.05,
};
export type BudgetLine = { label: string; detail: string; amount: number };
export type BudgetGroup = { id: string; label: string; lines: BudgetLine[]; total: number };
export type Budget = {
  groups: BudgetGroup[];
  subtotal: number;
  contingency: number;
  total: number;
  builtUpArea: number;
  perSqFt: number;
};

const WET = new Set(["bathroom", "attached-bathroom", "powder", "kitchen", "laundry", "utility"]);
const area = (r: Room) => r.width * r.length;
const sqft = (n: number) => `${indianGroup(n)} sq ft`;

export function estimateBudget(d: HomeDesign): Budget {
  const enclosed = d.rooms.filter((r) => !isOpenAir(r.type)),
    covered = d.rooms.filter((r) => isOpenAir(r.type) && ["balcony", "porch"].includes(r.type)),
    builtUpArea = enclosed.reduce((n, r) => n + area(r), 0),
    groundFootprint = d.rooms
      .filter((r) => r.floor === 0 && !isOpenAir(r.type))
      .reduce((n, r) => n + area(r), 0),
    groups: BudgetGroup[] = [];
  const group = (id: string, label: string, lines: BudgetLine[]) => {
    const kept = lines.filter((l) => l.amount > 0);
    if (kept.length)
      groups.push({ id, label, lines: kept, total: kept.reduce((n, l) => n + l.amount, 0) });
  };
  const coveredArea = covered.reduce((n, r) => n + area(r), 0);
  group("structure", "Structure", [
    {
      label: "Foundation",
      detail: `${sqft(groundFootprint)} × ${inr(RATES.foundationPerSqFt)}`,
      amount: groundFootprint * RATES.foundationPerSqFt,
    },
    {
      label: "RCC frame, slabs and masonry",
      detail: `${sqft(builtUpArea)} × ${inr(RATES.structurePerSqFt)}`,
      amount: builtUpArea * RATES.structurePerSqFt,
    },
    {
      label: "Balconies and porches",
      detail: `${sqft(coveredArea)} × ${inr(RATES.openAirStructurePerSqFt)}`,
      amount: coveredArea * RATES.openAirStructurePerSqFt,
    },
    ...d.stairs.map((s) => ({
      label: `${STAIR_TYPES[s.stairType].label} stair`,
      detail: "fabricated and finished",
      amount: STAIR_TYPES[s.stairType].price,
    })),
  ]);
  const wet = d.rooms.filter((r) => WET.has(r.type));
  group("services", "Electrical and plumbing", [
    {
      label: "Wiring, conduits and pipework",
      detail: `${sqft(builtUpArea)} × ${inr(RATES.electricalPlumbingPerSqFt)}`,
      amount: builtUpArea * RATES.electricalPlumbingPerSqFt,
    },
    {
      label: "Wet-room fixtures and drainage",
      detail: `${wet.length} rooms × ${inr(RATES.wetRoomFixturesEach)}`,
      amount: wet.length * RATES.wetRoomFixturesEach,
    },
  ]);
  const doorLines = Object.entries(
    d.doors.reduce<Record<string, number>>(
      (m, o) => ({ ...m, [o.doorType]: (m[o.doorType] ?? 0) + 1 }),
      {},
    ),
  ).map(([t, n]) => {
    const info = DOOR_TYPES[t as keyof typeof DOOR_TYPES];
    return {
      label: `${info.label} doors`,
      detail: `${n} × ${inr(info.price)}`,
      amount: n * info.price,
    };
  });
  const windowLines = Object.entries(
    d.windows.reduce<Record<string, number>>(
      (m, o) => ({ ...m, [o.windowType]: (m[o.windowType] ?? 0) + o.width * o.height }),
      {},
    ),
  ).map(([t, a]) => {
    const info = WINDOW_TYPES[t as keyof typeof WINDOW_TYPES];
    return {
      label: `${info.label} windows`,
      detail: `${sqft(a)} × ${inr(info.pricePerSqFt)}`,
      amount: a * info.pricePerSqFt,
    };
  });
  group("openings", "Doors and windows", [...doorLines, ...windowLines]);
  const floorLines = Object.entries(
    d.rooms.reduce<Record<string, number>>((m, r) => {
      const f = flooringOf(d, r);
      return { ...m, [f]: (m[f] ?? 0) + area(r) };
    }, {}),
  ).map(([f, a]) => {
    const info = FLOORING_INFO[f as keyof typeof FLOORING_INFO];
    return {
      label: info.label,
      detail: `${sqft(a)} × ${inr(info.pricePerSqFt)}`,
      amount: a * info.pricePerSqFt,
    };
  });
  // Paint: each enclosed room's own wall faces, less openings; exterior faces once more.
  const openingArea = (roomId: string) =>
    [...d.doors, ...d.windows]
      .filter((o) => o.roomId === roomId)
      .reduce((n, o) => n + o.width * o.height, 0);
  const interior = enclosed.reduce(
      (n, r) => n + 2 * (r.width + r.length) * d.floors[r.floor]!.height - openingArea(r.id),
      0,
    ),
    exterior = deriveWalls(d)
      .filter((w) => w.exterior && !w.open)
      .reduce((n, w) => n + Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) * w.height, 0);
  group("finishes", "Finishes", [
    ...floorLines,
    {
      label: "Interior paint",
      detail: `${sqft(interior)} × ${inr(RATES.interiorPaintPerSqFt)}`,
      amount: Math.max(0, interior) * RATES.interiorPaintPerSqFt,
    },
    {
      label: "Exterior paint",
      detail: `${sqft(exterior)} × ${inr(RATES.exteriorPaintPerSqFt)}`,
      amount: exterior * RATES.exteriorPaintPerSqFt,
    },
  ]);
  if (d.roof) {
    const top = d.floors.length - 1,
      footprint = d.rooms
        .filter((r) => r.floor === top && !isOpenAir(r.type))
        .reduce((n, r) => n + area(r), 0),
      m = ROOF_MATERIALS[d.roof.materialId] ?? ROOF_MATERIALS.rcc!,
      slope = d.roof.type === "flat" ? 1 : 1 / Math.cos((d.roof.pitchDeg * Math.PI) / 180),
      roofArea = footprint * slope;
    group("roof", "Roof", [
      {
        label: m.label,
        detail: `${sqft(roofArea)} × ${inr(m.pricePerSqFt)}`,
        amount: roofArea * m.pricePerSqFt,
      },
    ]);
  }
  if (d.compound) {
    const c = d.compound,
      run = compoundSegments(d.plot, c).reduce(
        (n, [a, b]) => n + Math.hypot(b.x - a.x, b.y - a.y),
        0,
      );
    group("site", "Compound and gates", [
      {
        label: "Boundary wall",
        detail: `${Math.round(run)} ft × ${c.height} ft × ${inr(RATES.compoundWallPerSqFt)}`,
        amount: run * c.height * RATES.compoundWallPerSqFt,
      },
      {
        label: `${c.gate.kind === "sliding" ? "Sliding" : "Swing"} gate`,
        detail: `${c.gate.width} ft`,
        amount: RATES.gate[c.gate.kind],
      },
      ...(c.pedestrianGate
        ? [
            {
              label: "Wicket gate",
              detail: `${c.pedestrianGate.width} ft`,
              amount: RATES.gate.pedestrian,
            },
          ]
        : []),
    ]);
  }
  group("systems", "Systems", [
    ...(d.systems.smartHome
      ? [
          {
            label: "Smart home",
            detail: `hub + ${sqft(builtUpArea)} × ${inr(RATES.smartHomePerSqFt)}`,
            amount: RATES.smartHomeBase + builtUpArea * RATES.smartHomePerSqFt,
          },
        ]
      : []),
    ...(d.systems.security
      ? [
          {
            label: "Security",
            detail: `CCTV, video door phone, ${d.floors.length} floors`,
            amount: RATES.securityBase + d.floors.length * RATES.securityPerFloor,
          },
        ]
      : []),
  ]);
  const byItem = new Map<string, { name: string; n: number; price: number }>();
  for (const p of d.furniture) {
    const item = itemFor(d, p.catalogId);
    if (!item || !item.price) continue;
    const e = byItem.get(item.id) ?? { name: item.name, n: 0, price: item.price };
    e.n++;
    byItem.set(item.id, e);
  }
  group(
    "furniture",
    "Furniture and appliances",
    [...byItem.values()]
      .sort((a, b) => b.n * b.price - a.n * a.price)
      .map((e) => ({
        label: e.name,
        detail: `${e.n} × ${inr(e.price)}`,
        amount: e.n * e.price,
      })),
  );
  const subtotal = groups.reduce((n, g) => n + g.total, 0),
    contingency = Math.round(subtotal * RATES.contingency),
    total = subtotal + contingency;
  return {
    groups,
    subtotal,
    contingency,
    total,
    builtUpArea,
    perSqFt: builtUpArea ? total / builtUpArea : 0,
  };
}
