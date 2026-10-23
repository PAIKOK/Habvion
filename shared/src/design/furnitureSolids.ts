import type { FurnitureItem } from "../types/home";

/** The usable top is not the overall height (e.g. a mattress vs its headboard). */
export const workingHeight = (item: FurnitureItem) => item.surfaceHeightFt ?? item.height;
export type Solid = { x: number; y: number; width: number; depth: number; bottom: number; top: number; round?: boolean };

/** Solid parts in local feet, not the empty space inside an item's bounding box. */
export function furnitureSolids(item: FurnitureItem): Solid[] {
  const { width: w, depth: d, height: h } = item;
  const solid = (x: number, y: number, width: number, depth: number, bottom = 0, top = h, round = false): Solid => ({ x, y, width, depth, bottom, top, round });
  if (item.mount === "ceiling" || item.mount === "surface" || item.shape === "rug" || item.shape === "curtain") return [];
  if (item.shape === "tree") {
    const diameter = Math.min(0.76, Math.max(0.24, Math.min(w, d) * 0.11));
    return [solid(0, 0, diameter, diameter, 0, h * 0.65, true)];
  }
  if (item.shape === "plant") {
    if (item.id === "planter") return [solid(0, 0, w, d, 0, h * 0.42)];
    if (item.id === "fountain") return [solid(0, 0, w, d, 0, h, true)];
    const diameter = Math.min(w, d) * (item.id === "shrub" ? 0.85 : 0.7);
    return [solid(0, 0, diameter, diameter, 0, item.id === "shrub" ? h : Math.max(1.15, h * 0.3), true)];
  }
  if (item.shape === "pergola") {
    return [-1, 1].flatMap(x => [-1, 1].map(y => solid(x * (w / 2 - 0.22), y * (d / 2 - 0.22), 0.36, 0.36)));
  }
  if (item.shape === "lamp" || item.id === "diya-stand") return [solid(0, 0, 0.16, 0.16, 0, h, true)];
  if (item.shape === "shower") {
    return [solid(0, -d / 2 + 0.04, w, 0.08), solid(w / 2 - 0.04, 0, 0.08, d), solid(w * 0.32, d / 2 - 0.04, w * 0.36, 0.08)];
  }
  if (item.id === "sofa-l") {
    const depth = Math.min(3, d);
    return [solid(0, -d / 2 + depth / 2, w, depth), solid(w * 0.33, 0, w * 0.34, d)];
  }
  if (item.id === "desk-l") return [solid(0, -d / 2 + 1, w, 2), solid(-w / 2 + 1, 0, 2, d)];
  if (item.shape === "bike") return [solid(0, 0, Math.min(0.7, w * 0.35), d), solid(0, d * 0.3, w, 0.32, h * 0.55, h)];
  if (item.shape === "tank" || item.shape === "fan" && item.mount === "floor" || item.id.includes("round")) return [solid(0, 0, Math.min(w, d), Math.min(w, d), 0, h, true)];
  return [solid(0, 0, w, d)];
}
