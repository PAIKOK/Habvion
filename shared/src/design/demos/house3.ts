import { HouseBuilder, type BuildResult } from "./builder";
import { lightRooms } from "./archetypes";
import { courtyardFloors } from "./courtyard";

/**
 * Luxury Courtyard Villa — 40×60, north road, three full levels.
 * Five bedrooms around an open-to-sky courtyard; the second floor holds a home theatre,
 * a gym, a sky deck over the front rooms and a terrace off the gym.
 */
export function luxuryCourtyardVilla(): BuildResult {
  const b = new HouseBuilder({ id: "demo-luxury-courtyard-villa", name: "Luxury Courtyard Villa", width: 40, length: 60, floors: 3, roadSide: "north", parkingNeed: "2-car" });
  courtyardFloors(b, { study: "home-office", twoWheelers: false });
  b.stair("st1", 4, 30.5, 7, 11, 1, "north", "dog-legged");
  // Second floor
  b.addRoom("sr2", "Staircase", "staircase", 3, 26, 10, 19, 2)
    .addRoom("lobby", "Entertainment lobby", "hall", 13, 40, 14, 5, 2)
    .addRoom("thtr", "Home theatre", "home-theatre", 13, 45, 14, 13, 2)
    .addRoom("gym", "Gym", "gym", 27, 30, 10, 14, 2)
    .addRoom("terr", "Gym terrace", "terrace", 27, 44, 10, 14, 2)
    .addRoom("deck", "Sky deck", "terrace", 13, 18, 24, 12, 2);
  b.door("lobby", "west", 3, 3, "panel")
    .door("thtr", "north", 7, 3, "panel")
    .door("gym", "west", 12, 3, "panel")
    .door("terr", "north", 5, 4, "sliding")
    .door("deck", "west", 10, 3, "panel");
  b.window("sr2", "west", 9.5, 3, "casement")
    .window("lobby", "north", 7, 4, "casement")
    .window("gym", "east", 7, 5, "casement", 4.5, 2.5)
    .window("gym", "west", 5, 4, "casement", 4.5, 2.5);
  // Theatre: screen on the south wall, two rows of recliners facing it.
  b.tryAgainst("thtr", "south", null, "projector-screen");
  // Rotation 0 faces south, towards the screen; the back row leaves the door's swing clear.
  for (const x of [16.5, 20, 23.5]) b.put("thtr", "recliner", x, 52.8, 0);
  for (const x of [16.5, 23.5]) b.put("thtr", "recliner", x, 47.6, 0);
  b.put("thtr", "projector", 20, 49, 0, true);
  b.tryAgainst("thtr", "south", 2, "speakers") && b.tryAgainst("thtr", "south", 12, "speakers");
  b.trySomewhere("gym", "treadmill", { sides: ["east"] });
  b.trySomewhere("gym", "home-gym");
  b.trySomewhere("gym", "exercise-bike");
  b.trySomewhere("gym", "dumbbell-rack");
  b.put("deck", "pergola", 25, 24);
  b.put("deck", "outdoor-sofa", 25, 21.5, 0, true);
  b.put("deck", "outdoor-table", 25, 25, 0, true);
  for (const id of ["planter", "planter", "sun-lounger", "sun-lounger"]) b.trySomewhere("deck", id);
  b.put("terr", "water-tank", 34.5, 54.5);
  b.put("terr", "solar", 31, 49, 90, true);
  for (const id of ["planter", "patio-chair"]) b.trySomewhere("terr", id);
  for (const [id, f] of [["lobby", "granite"], ["sr2", "granite"], ["thtr", "wood"], ["gym", "vinyl"], ["deck", "outdoor-tile"], ["terr", "outdoor-tile"]] as const) b.flooring(id, f);
  b.walled({ offset: 13.5, width: 14, kind: "swing" }, { offset: 30.5, width: 3.5 });
  b.roof("flat", "rcc").systems(true, true);
  b.paint("liv", "#f5f0e8").paintWall("liv", "west", "#7a5c3e").paint("thtr", "#2b2b33").paint("gym", "#e9eef2").paint("mst", "#efe1d1");
  lightRooms(b);
  return b.result();
}
