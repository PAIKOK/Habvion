import { HouseBuilder, type BuildResult } from "./builder";
import { furnishBathroom, furnishBedroom, furnishDining, furnishKitchen, landscape, lightRooms } from "./archetypes";

/**
 * Garden Bungalow — 40×60, one floor, three bedrooms and two bathrooms.
 * A landscaped front garden and entrance porch lead into the shared living room.
 * Bedrooms and bathrooms open from halls, not through another bedroom; the master
 * has its own bath. The rear patio is reached directly from the bedroom hall.
 */
export function gardenBungalow(): BuildResult {
  const b = new HouseBuilder({ id: "demo-garden-bungalow", name: "Garden Bungalow", width: 40, length: 60, floors: 1, roadSide: "north", parkingNeed: "1-car" });
  b.setbacks(6, 3, 3, 3);
  b.addRoom("park", "Car parking", "parking", 3, 6, 11, 16)
    .addRoom("garden", "Front garden", "garden", 14, 6, 8, 8)
    .addRoom("porch", "Entrance porch", "porch", 22, 6, 15, 8)
    .addRoom("liv", "Living & dining", "living", 14, 14, 23, 13)
    .addRoom("bed2", "Bedroom 2", "bedroom", 3, 22, 11, 12)
    .addRoom("hall", "Bedroom hall", "hall", 14, 27, 6, 25)
    .addRoom("court", "Garden courtyard", "courtyard", 20, 27, 9, 13)
    .addRoom("kit", "Kitchen", "kitchen", 29, 27, 8, 13)
    .addRoom("mst", "Master bedroom", "master-bedroom", 3, 34, 11, 15)
    .addRoom("mbath", "Master bath", "attached-bathroom", 3, 49, 11, 8)
    .addRoom("lobby", "Guest lobby", "hall", 20, 40, 9, 7)
    .addRoom("bath", "Common bath", "bathroom", 29, 40, 8, 7)
    .addRoom("guest", "Guest bedroom", "guest-bedroom", 20, 47, 17, 10)
    .addRoom("patio", "Rear patio", "porch", 14, 52, 6, 5);

  b.door("liv", "north", 11, 3.5, "panel")
    .door("liv", "south", 3, 3.5, "panel")
    .door("court", "west", 5, 3, "sliding")
    .door("bed2", "east", 8, 3, "panel")
    .door("mst", "east", 3, 3, "panel")
    .door("mbath", "north", 9, 2.75, "flush")
    .door("kit", "west", 10.75, 3, "panel")
    .door("lobby", "west", 3.5, 3, "panel")
    .door("bath", "west", 3.5, 2.75, "flush")
    .door("guest", "north", 3, 3, "panel")
    .door("hall", "south", 3, 3, "sliding");

  b.window("liv", "north", 4, 5, "casement", 4.5, 2.5)
    .window("liv", "east", 6.5, 6, "casement", 4.5, 2.5)
    .window("liv", "west", 3, 3, "casement", 4.5, 2.5)
    .window("bed2", "west", 6, 5, "casement", 4.5, 2.5)
    .window("bed2", "north", 5.5, 4, "casement", 4.5, 2.5)
    .window("mst", "west", 7.5, 5, "casement", 4.5, 2.5)
    .window("mbath", "west", 4, 2, "awning", 2, 5)
    .window("mbath", "south", 5.5, 3, "awning", 2, 5)
    .window("kit", "east", 6.5, 4, "sliding", 3.5, 3.5)
    .window("bath", "east", 3.5, 2, "awning", 2, 5)
    .window("guest", "east", 5, 4, "casement", 4.5, 2.5)
    .window("guest", "south", 8.5, 6, "casement", 4.5, 2.5);

  b.walled({ offset: 8.5, width: 10, kind: "sliding" }, { offset: 33, width: 4 });
  b.roof("flat", "rcc");
  for (const [id, flooring] of [
    ["park", "concrete"], ["garden", "grass"], ["porch", "outdoor-tile"],
    ["liv", "vitrified"], ["court", "grass"], ["hall", "vitrified"], ["lobby", "vitrified"],
    ["kit", "anti-skid"], ["mst", "wood"], ["bed2", "laminate"], ["guest", "laminate"],
    ["mbath", "anti-skid"], ["bath", "anti-skid"], ["patio", "outdoor-tile"],
  ] as const) b.flooring(id, flooring);
  b.paint("liv", "#f4eadb").paintWall("liv", "east", "#74846b")
    .paint("mst", "#e5d2bb")
    .paint("bed2", "#dce6d3").paint("guest", "#d9e3e7");

  // Two furniture groups leave a clear route between the porch and bedroom hall.
  b.put("liv", "sofa-3", 19.5, 15.51, 0);
  const tv = b.against("liv", "south", 8.75, "tv-unit");
  if (tv) b.put("liv", "tv-55", tv.x, tv.y, tv.rotation, true);
  b.put("liv", "rug-medium", 19.5, 20.5, 0, true);
  b.put("liv", "coffee-table", 19.5, 20.5, 0, true);
  b.trySomewhere("liv", "floor-lamp");
  b.put("liv", "ceiling-fan", 19.5, 20, 0, true);
  furnishDining(b, "liv", { x: 32.5, y: 20.5, alongX: false, span: 10 });
  furnishKitchen(b, "kit");
  furnishBedroom(b, "mst", { bed: "bed-king", wardrobe: "wardrobe-3" });
  furnishBedroom(b, "bed2", { bed: "bed-queen", desk: true });
  furnishBedroom(b, "guest", { bed: "bed-queen" });
  furnishBathroom(b, "mbath", { basin: "vanity" });
  furnishBathroom(b, "bath");
  landscape(b, "court", ["planter", "areca-palm", "garden-lamp"]);
  landscape(b, "garden", ["shade-tree", "shrub", "shrub", "planter", "garden-lamp"]);
  b.put("park", "car-sedan", 8.5, 14, 180);
  for (const room of ["porch", "patio"]) {
    b.trySomewhere(room, "bench");
    b.trySomewhere(room, "planter");
  }
  // Keep the bedroom hall and guest lobby clear rather than filling passageways.
  lightRooms(b);
  return b.result();
}
