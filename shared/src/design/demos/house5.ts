import { HouseBuilder, type BuildResult } from "./builder";
import { lightRooms } from "./archetypes";
import { courtyardFloors } from "./courtyard";

/**
 * Contemporary Courtyard Residence — 40×60, north road, ground + first + terrace.
 * 5 bedrooms, 5 bathrooms and a powder room around an open-to-sky courtyard; parking
 * for two cars and two two-wheelers behind a sliding gate, with a separate wicket gate
 * and path; an enclosed staircase on every level; a roof terrace with pergola, lawn,
 * barbecue, water tank and solar panels.
 */
export function contemporaryCourtyardResidence(): BuildResult {
  const b = new HouseBuilder({ id: "demo-contemporary-courtyard", name: "Contemporary Courtyard Residence", width: 40, length: 60, floors: 3, roadSide: "north", parkingNeed: "2-car" });
  courtyardFloors(b, { study: "study", twoWheelers: true });
  b.stair("st1", 4, 30.5, 7, 11, 1, "north", "dog-legged");
  // Terrace level: the stair room and an open terrace over the master suite.
  b.addRoom("sr2", "Staircase", "staircase", 3, 26, 10, 19, 2).addRoom("terr", "Roof terrace", "terrace", 13, 40, 24, 18, 2);
  b.door("terr", "west", 3, 3, "panel");
  b.window("sr2", "west", 9.5, 3, "casement");
  b.put("terr", "pergola", 19, 47);
  b.put("terr", "outdoor-sofa", 19, 44.5, 0, true);
  b.put("terr", "outdoor-table", 19, 48, 0, true);
  b.put("terr", "bbq", 15, 55.5, 180, true);
  b.put("terr", "water-tank", 34.5, 42.5);
  b.put("terr", "solar", 29, 55.5, 180);
  b.put("terr", "solar", 34, 51, 90, true);
  for (const id of ["planter", "planter", "shrub", "shrub", "sun-lounger"]) b.trySomewhere("terr", id);
  b.flooring("terr", "grass").flooring("sr2", "granite");
  b.walled({ offset: 13.5, width: 14, kind: "sliding" }, { offset: 30.5, width: 3.5 });
  b.roof("flat", "rcc").systems(true, true);
  b.paint("liv", "#f3eee6").paintWall("liv", "west", "#5b6b5a").paint("mst", "#e6d5c3").paint("lng", "#eef0ea").paint("bed2", "#dde8e4").paint("bed3", "#efe2cf").paint("bed4", "#e2e3ef");
  lightRooms(b);
  return b.result();
}
