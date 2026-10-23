import { HouseBuilder, type BuildResult } from "./builder";
import { furnishBathroom, furnishBedroom, furnishDining, furnishKitchen, lightRooms } from "./archetypes";

/**
 * Indian Standard Home — 30×40, north-facing, single storey, 2 BHK, laid out to Vastu:
 * pooja in the north-east, kitchen in the south-east, master bedroom in the south-west,
 * car in the north-west and the entrance on the north. Rooms meet NBC minimums.
 */
export function indianStandardHome(): BuildResult {
  const b = new HouseBuilder({ id: "demo-indian-standard-home", name: "Indian Standard Home", width: 30, length: 40, floors: 1, roadSide: "north", parkingNeed: "1-car" });
  b.setbacks(5, 2, 2, 2);
  b.addRoom("park", "Car parking", "parking", 2, 1, 11, 13)
    .addRoom("porch", "Porch", "porch", 13, 5, 8, 6)
    .addRoom("pooja", "Pooja room", "pooja", 21, 5, 7, 6)
    .addRoom("liv", "Living & dining", "living", 13, 11, 15, 14)
    .addRoom("bed2", "Bedroom 2", "bedroom", 2, 14, 11, 11)
    .addRoom("mst", "Master bedroom", "master-bedroom", 2, 25, 11, 13)
    .addRoom("hall", "Hall", "hall", 13, 25, 7, 7)
    .addRoom("bath", "Common bath", "bathroom", 13, 32, 7, 6)
    .addRoom("kit", "Kitchen", "kitchen", 20, 25, 8, 13);
  b.door("liv", "north", 4, 3.5, "panel")
    .door("pooja", "south", 4.5, 3, "sliding")
    .door("bed2", "east", 9, 3, "panel")
    .door("hall", "north", 5, 3, "panel")
    .door("kit", "north", 4.5, 3, "panel")
    .door("mst", "east", 3.5, 3, "panel")
    .door("bath", "north", 3.5, 2.5, "flush")
    .door("kit", "south", 2.5, 3, "flush");
  b.window("pooja", "east", 3, 2, "casement", 3, 3.5)
    .window("pooja", "north", 3.5, 2, "casement", 3, 3.5)
    .window("liv", "east", 4, 5, "casement", 4.5, 2.5)
    .window("liv", "east", 10.5, 4, "casement", 4.5, 2.5)
    .window("bed2", "west", 5.5, 5, "casement", 4.5, 2.5)
    .window("bed2", "north", 5.5, 4, "casement", 4.5, 2.5)
    .window("mst", "west", 6.5, 5, "casement", 4.5, 2.5)
    .window("mst", "south", 5.5, 5, "casement", 4.5, 2.5)
    .window("kit", "east", 6.5, 4, "sliding", 3.5, 3.5)
    .window("kit", "south", 6, 2.5, "awning", 2.5, 4.5)
    .window("bath", "south", 3.5, 2, "awning", 2, 5);
  b.walled({ offset: 7.5, width: 10, kind: "swing" }, { offset: 17, width: 3.5 });
  b.roof("flat", "rcc");
  for (const [id, f] of [["liv", "vitrified"], ["hall", "vitrified"], ["pooja", "marble"], ["kit", "anti-skid"], ["mst", "vitrified"], ["bed2", "vitrified"], ["porch", "granite"], ["park", "concrete"]] as const) b.flooring(id, f);
  b.paint("liv", "#f6ead2").paint("pooja", "#fff6e0").paintWall("pooja", "east", "#e9a23b").paint("mst", "#e8d2c0").paint("bed2", "#d7e6d0");
  // The dining end is by the kitchen door; the sitting end by the entrance.
  furnishDining(b, "liv", { x: 24.75, y: 18, alongX: false, span: 10 });
  const tv = b.tryAgainst("liv", "west", 7.1, "tv-unit");
  if (tv) b.put("liv", "tv-55", tv.x, tv.y, tv.rotation, true);
  b.put("liv", "rug-medium", 17, 18.1, 90, true);
  b.put("liv", "sofa-3", 18.75, 18.1, 90);
  b.trySomewhere("liv", "floor-lamp");
  b.put("liv", "ceiling-fan", 16.5, 18, 0, true);
  b.trySomewhere("liv", "plant-floor");
  furnishKitchen(b, "kit");
  furnishBedroom(b, "mst", { bed: "bed-king", wardrobe: "wardrobe-3" });
  furnishBedroom(b, "bed2", { bed: "bed-queen" });
  furnishBathroom(b, "bath");
  // The mandir faces east from the west wall, as Vastu asks.
  b.tryAgainst("pooja", "west", 2.5, "mandir-marble") ?? b.tryAgainst("pooja", "west", 2.5, "mandir");
  b.trySomewhere("pooja", "diya-stand");
  b.put("park", "car-hatch", 7.5, 7.5, 180);
  b.trySomewhere("porch", "bench");
  b.trySomewhere("porch", "planter");
  lightRooms(b);
  return b.result();
}
