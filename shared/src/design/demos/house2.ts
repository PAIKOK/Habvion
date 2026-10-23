import { HouseBuilder, type BuildResult } from "./builder";
import { furnishBathroom, furnishBedroom, furnishDining, furnishKitchen, furnishLiving, lightRooms } from "./archetypes";

/**
 * Smart Urban Home — 20×40, north road, two floors, 3 BHK.
 * One room wide: a stair hall runs down the west side on both floors and every room
 * opens off it. The car parks under the first-floor bedroom.
 */
export function smartUrbanHome(): BuildResult {
  const b = new HouseBuilder({ id: "demo-smart-urban-home", name: "Smart Urban Home", width: 20, length: 40, floors: 2, roadSide: "north", parkingNeed: "1-car" });
  b.setbacks(3, 1, 1, 1);
  // Ground floor
  b.addRoom("hall", "Stair hall", "hall", 1, 3, 7.75, 22)
    .addRoom("park", "Car parking", "parking", 8.75, 1, 10.25, 13)
    .addRoom("liv", "Living room", "living", 8.75, 14, 10.25, 14)
    .addRoom("din", "Dining", "dining", 8.75, 28, 10.25, 11)
    .addRoom("kit", "Kitchen", "kitchen", 1, 25, 7.75, 14);
  b.stair("st1", 1.25, 8, 3.5, 15, 0, "north", "straight");
  b.door("hall", "north", 5.5, 3.5, "pivot")
    .door("hall", "east", 7, 3, "flush")
    .door("hall", "east", 17, 3, "panel")
    .door("hall", "south", 5.5, 3, "panel")
    .door("liv", "south", 5, 3.5, "panel");
  b.window("hall", "west", 3, 2, "casement")
    .window("liv", "east", 7, 5, "casement", 4.5, 2.5)
    .window("din", "east", 5.5, 4, "sliding", 4.5, 2.5)
    .window("din", "south", 5, 4, "casement", 4.5, 2.5)
    .window("kit", "west", 7, 4, "sliding", 3.5, 3.5)
    .window("kit", "south", 4, 3, "awning", 2.5, 4.5);
  // First floor
  b.addRoom("hall1", "Upper hall", "hall", 1, 3, 7.75, 26, 1)
    .addRoom("bed2", "Bedroom 2", "bedroom", 8.75, 3, 10.25, 9, 1)
    .addRoom("mst", "Master bedroom", "master-bedroom", 8.75, 12, 10.25, 13, 1)
    .addRoom("bed3", "Bedroom 3", "bedroom", 8.75, 25, 10.25, 14, 1)
    .addRoom("bath", "Common bath", "bathroom", 1, 29, 7.75, 5, 1)
    .addRoom("b3bath", "Bedroom 3 bath", "attached-bathroom", 1, 34, 7.75, 5, 1);
  b.door("bed2", "west", 5, 3, "panel")
    .door("mst", "west", 6.5, 3, "panel")
    .door("bed3", "west", 2, 3, "panel")
    .door("bath", "north", 5, 2.5, "flush")
    .door("b3bath", "east", 3.25, 2.5, "flush");
  b.window("bed2", "north", 5, 4, "casement", 4.5, 2.5)
    .window("bed2", "east", 4.5, 4, "casement", 4.5, 2.5)
    .window("mst", "east", 6.5, 5, "casement", 4.5, 2.5)
    .window("bed3", "east", 7, 4, "casement", 4.5, 2.5)
    .window("bed3", "south", 5, 4, "casement", 4.5, 2.5)
    .window("bath", "west", 2.5, 2, "awning", 2, 5)
    .window("b3bath", "west", 2.5, 2, "awning", 2, 5)
    .window("hall1", "north", 4, 3, "casement")
    .window("hall1", "west", 22, 3, "casement");
  // Site and finishes
  b.walled({ offset: 13.875, width: 9, kind: "sliding" }, { offset: 5, width: 3.5 });
  b.roof("flat", "rcc").systems(true, true);
  for (const [id, f] of [["hall", "granite"], ["hall1", "granite"], ["liv", "vitrified"], ["din", "vitrified"], ["kit", "anti-skid"], ["mst", "wood"], ["bed2", "laminate"], ["bed3", "laminate"], ["park", "concrete"]] as const) b.flooring(id, f);
  b.paint("liv", "#eef1f4").paintWall("liv", "east", "#33506b").paint("mst", "#d9e3ea").paint("bed2", "#f1e6d2").paint("bed3", "#dfe9dc");
  // Furniture
  furnishLiving(b, "liv");
  furnishDining(b, "din");
  furnishKitchen(b, "kit");
  // A short return under the south window turns the galley into an L with worktop space.
  if (b.put("kit", "counter-4", 4.7, 37.99, 180, true))
    for (const [id, x] of [["otg", 3.6], ["mixer", 5.2], ["fruit-bowl", 6.1]] as const) b.put("kit", id, x, 37.99, 180, true);
  furnishBedroom(b, "mst", { bed: "bed-king", wardrobe: "wardrobe-3" });
  furnishBedroom(b, "bed2", { bed: "bed-queen", desk: true });
  furnishBedroom(b, "bed3", { bed: "bed-queen" });
  furnishBathroom(b, "bath");
  furnishBathroom(b, "b3bath");
  b.put("park", "car-hatch", 13.875, 7.5, 180);
  b.trySomewhere("hall", "shoe-rack", { sides: ["east"] });
  b.trySomewhere("hall", "console", { sides: ["east"] });
  b.trySomewhere("liv", "smart-hub");
  lightRooms(b);
  return b.result();
}
