import type { DoorType, WindowType } from "../types/home";
export const DOOR_TYPES: Record<
  DoorType,
  { label: string; swings: boolean; minWidth: number; price: number }
> = {
  panel: { label: "Panel", swings: true, minWidth: 2.5, price: 8500 },
  flush: { label: "Flush", swings: true, minWidth: 2.5, price: 4500 },
  sliding: { label: "Sliding", swings: false, minWidth: 2.5, price: 18000 },
  french: { label: "French", swings: true, minWidth: 5, price: 36000 },
  barn: { label: "Barn", swings: false, minWidth: 3, price: 16000 },
  bifold: { label: "Bifold", swings: false, minWidth: 3, price: 15000 },
  louvered: { label: "Louvered", swings: true, minWidth: 2, price: 9500 },
  pivot: { label: "Pivot", swings: true, minWidth: 3, price: 28000 },
};
export const WINDOW_TYPES: Record<
  WindowType,
  { label: string; minWidth: number; pricePerSqFt: number }
> = {
  "single-hung": { label: "Single hung", minWidth: 1.5, pricePerSqFt: 1300 },
  "double-hung": { label: "Double hung", minWidth: 2, pricePerSqFt: 1650 },
  casement: { label: "Casement", minWidth: 1.5, pricePerSqFt: 1450 },
  sliding: { label: "Sliding", minWidth: 3, pricePerSqFt: 1400 },
  awning: { label: "Awning", minWidth: 1.5, pricePerSqFt: 1500 },
  picture: { label: "Picture", minWidth: 2, pricePerSqFt: 1600 },
  bay: { label: "Bay", minWidth: 4, pricePerSqFt: 2500 },
};
