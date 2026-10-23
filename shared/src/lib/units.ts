import type { Unit } from "../types/home";
export const feet = (value: number, unit: Unit) => (unit === "m" ? value / 0.3048 : value);
export const displayLength = (value: number, unit: Unit) => (unit === "m" ? value * 0.3048 : value);
export const lengthLabel = (value: number, unit: Unit = "ft") =>
  `${Number(displayLength(value, unit).toFixed(unit === "m" ? 2 : 1))} ${unit}`;
export const areaLabel = (value: number, unit: Unit = "ft") =>
  `${Number((unit === "m" ? value * 0.09290304 : value).toFixed(1))} ${unit === "m" ? "m²" : "sq ft"}`;
/** Indian digit grouping (12,34,567) without relying on the runtime's ICU data. */
export function indianGroup(n: number) {
  const s = String(Math.abs(Math.round(n))),
    last3 = s.slice(-3),
    rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (n < 0 ? "-" : "") + (rest ? `${rest},${last3}` : last3);
}
export const inr = (amount: number) => `₹${indianGroup(amount)}`;
export const compactInr = (amount: number) =>
  amount >= 1e7
    ? `₹${(amount / 1e7).toFixed(2)} crore`
    : amount >= 1e5
      ? `₹${(amount / 1e5).toFixed(2)} lakh`
      : inr(amount);
const ORDINALS = ["Ground", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth"];
export const floorLabel = (level: number) => `${ORDINALS[level] ?? `Level ${level}`} floor`;
/** "1 room", "3 rooms". */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
