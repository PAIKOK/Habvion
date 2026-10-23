import type { BuildResult } from "./builder";
import { modernFamilyVilla } from "./house1";
import { smartUrbanHome } from "./house2";
import { luxuryCourtyardVilla } from "./house3";
import { indianStandardHome } from "./house4";
import { contemporaryCourtyardResidence } from "./house5";
import { gardenBungalow } from "./house6";

export type DemoHouse = { id: string; title: string; tagline: string; build: () => BuildResult };
export const DEMOS: DemoHouse[] = [
  { id: "modern-family-villa", title: "Modern Family Villa", tagline: "4 BHK on a 30×50 plot, two floors, family lounge upstairs.", build: modernFamilyVilla },
  { id: "smart-urban-home", title: "Smart Urban Home", tagline: "3 BHK on a narrow 20×40 plot, one room wide, car under the bedroom.", build: smartUrbanHome },
  { id: "luxury-courtyard-villa", title: "Luxury Courtyard Villa", tagline: "5 bedrooms around an open courtyard on 40×60, with a home theatre, gym and sky deck.", build: luxuryCourtyardVilla },
  { id: "indian-standard-home", title: "Indian Standard Home", tagline: "Vastu 2 BHK on a north-facing 30×40 plot, single storey.", build: indianStandardHome },
  { id: "contemporary-courtyard", title: "Contemporary Courtyard Residence", tagline: "5 bed / 5 bath on 40×60: central courtyard, two cars, roof terrace with pergola and solar.", build: contemporaryCourtyardResidence },
  { id: "garden-bungalow", title: "Garden Bungalow", tagline: "Single-floor 3 BHK on a 40×60 plot, with a landscaped front garden, rear patio and car parking.", build: gardenBungalow },
];
const cache = new Map<string, BuildResult>();
/** Demos are deterministic, so each is built once per process. */
export function buildDemo(id: string): BuildResult | null {
  const demo = DEMOS.find((d) => d.id === id);
  if (!demo) return null;
  if (!cache.has(id)) cache.set(id, demo.build());
  return cache.get(id)!;
}
