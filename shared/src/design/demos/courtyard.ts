import type { HouseBuilder } from "./builder";
import { furnishBathroom, furnishBedroom, furnishDining, furnishKitchen, furnishLiving, furnishStudy, landscape } from "./archetypes";

/**
 * The 10×8 bedrooms beside the stair: the door swings in at the north-east and the bath
 * opens at the south-west, so the bed's head goes on the east wall between them and
 * an almirah stands in the north-west corner, clear of the bed's foot.
 */
function compactBedroom(b: HouseBuilder, roomId: string) {
  const r = b.room(roomId);
  b.put(roomId, "bed-double", r.x + r.width - 3.25, r.y + 5.5, 90);
  b.against(roomId, "north", 1.6, "almirah");
  b.tryAgainst(roomId, "west", 5, "ac-split");
  b.put(roomId, "ceiling-fan", r.x + 6, r.y + 4, 0, true);
  b.put(roomId, "ceiling-light", r.x + 3, r.y + 6.5, 0, true);
}

/**
 * The shared skeleton of the two 40×60 courtyard houses: an open-to-sky courtyard in
 * the middle, an enclosed staircase room on the west whose landing upstairs is its own
 * (no door opens onto it), and rooms on every side of the court.
 *
 *   Ground: two-car porch and front lawn, foyer, powder, living, dining, kitchen,
 *           utility, study, guest suite.
 *   First:  master suite (study, walk-in, bath, rear balcony), three bedrooms with baths,
 *           family lounge, gallery and front balcony.
 */
export function courtyardFloors(b: HouseBuilder, o: { study: "study" | "home-office"; twoWheelers: boolean }) {
  b.setbacks(6, 1.5, 3, 3);
  // Ground floor
  b.addRoom("park", "Car porch", "parking", 3, 2, 21, 16)
    .addRoom("lawn", "Front lawn", "garden", 24, 2, 13, 11)
    .addRoom("porch", "Entrance porch", "porch", 24, 13, 13, 5)
    .addRoom("foy", "Foyer", "foyer", 25, 18, 8, 12)
    .addRoom("pwd", "Powder room", "powder", 33, 18, 4, 6)
    .addRoom("store", "Store", "store", 33, 24, 4, 6)
    .addRoom("liv", "Living room", "living", 3, 18, 22, 12)
    .addRoom("sr", "Staircase", "staircase", 3, 30, 10, 15)
    .addRoom("court", "Courtyard", "courtyard", 13, 30, 14, 10)
    .addRoom("din", "Dining", "dining", 27, 30, 10, 14)
    .addRoom("hall", "Courtyard hall", "hall", 13, 40, 14, 6)
    .addRoom("kit", "Kitchen", "kitchen", 27, 44, 10, 14)
    .addRoom("gst", "Guest bedroom", "guest-bedroom", 3, 45, 10, 8)
    .addRoom("gbath", "Guest bath", "attached-bathroom", 3, 53, 10, 5)
    .addRoom("study", o.study === "study" ? "Study" : "Home office", o.study, 13, 46, 8, 12)
    .addRoom("util", "Utility", "utility", 21, 46, 6, 12);
  b.stair("st0", 4, 30.5, 7, 11, 0, "north", "dog-legged");
  b.door("foy", "north", 4, 3.5, "pivot")
    .door("pwd", "west", 3, 2.5, "flush")
    .door("store", "west", 3, 2.5, "flush")
    .door("liv", "east", 5, 3.5, "panel")
    .door("din", "north", 3, 3, "panel")
    .door("hall", "east", 2, 3, "panel")
    .door("kit", "north", 5, 3, "panel")
    .door("sr", "east", 13, 3, "panel")
    .door("gst", "north", 7.5, 3, "panel")
    .door("gbath", "north", 1.75, 2.5, "flush")
    .door("hall", "north", 7, 5, "french")
    .door("liv", "south", 16, 5, "french")
    .door("court", "east", 5, 5, "sliding")
    .door("study", "north", 4, 3, "panel")
    .door("util", "east", 6, 3, "flush");
  b.window("liv", "north", 6, 5, "casement", 4.5, 2.5)
    .window("liv", "north", 15, 5, "casement", 4.5, 2.5)
    .window("liv", "west", 6, 5, "casement", 4.5, 2.5)
    .window("pwd", "east", 3, 2, "awning", 2, 5)
    .window("sr", "west", 7.5, 3, "casement")
    .window("din", "east", 7, 5, "casement", 4.5, 2.5)
    .window("kit", "east", 7, 4, "sliding", 3.5, 3.5)
    .window("kit", "south", 5, 3, "awning", 2.5, 4.5)
    .window("gst", "west", 4, 4, "casement", 4.5, 2.5)
    .window("gbath", "west", 2.5, 2, "awning", 2, 5)
    .window("study", "south", 4, 4, "casement", 4.5, 2.5)
    .window("util", "south", 3, 3, "awning", 2.5, 4.5)
    .window("hall", "north", 2.5, 3, "casement")
    .window("hall", "north", 11.5, 3, "casement");
  // First floor
  b.addRoom("sr1", "Staircase", "staircase", 3, 26, 10, 19, 1)
    .addRoom("bed3", "Bedroom 3", "bedroom", 3, 14, 10, 12, 1)
    .addRoom("b3bath", "Bedroom 3 bath", "attached-bathroom", 13, 18, 6, 8, 1)
    .addRoom("b4bath", "Bedroom 4 bath", "attached-bathroom", 19, 18, 8, 8, 1)
    .addRoom("bed4", "Bedroom 4", "bedroom", 27, 18, 10, 12, 1)
    .addRoom("fbal", "Front balcony", "balcony", 13, 14, 14, 4, 1)
    .addRoom("gal", "Gallery", "hall", 13, 26, 14, 4, 1)
    .addRoom("lng", "Family lounge", "family", 27, 30, 10, 14, 1)
    .addRoom("uhall", "Upper hall", "hall", 13, 40, 14, 6, 1)
    .addRoom("mst", "Master bedroom", "master-bedroom", 13, 46, 14, 9, 1)
    .addRoom("rbal", "Rear balcony", "balcony", 13, 55, 14, 3, 1)
    .addRoom("mstudy", "Master study", "study", 27, 44, 10, 6.5, 1)
    .addRoom("wiw", "Walk-in wardrobe", "walk-in-wardrobe", 27, 50.5, 5, 8, 1)
    .addRoom("mbath", "Master bath", "attached-bathroom", 32, 50.5, 5, 8, 1)
    .addRoom("bed2", "Bedroom 2", "bedroom", 3, 45, 10, 8, 1)
    .addRoom("b2bath", "Bedroom 2 bath", "attached-bathroom", 3, 53, 10, 5, 1);
  b.door("bed3", "south", 5, 3, "panel")
    .door("bed3", "east", 2, 3, "sliding")
    .door("b3bath", "west", 4, 2.5, "flush")
    .door("gal", "west", 2, 3, "panel")
    .door("bed4", "west", 10, 3, "panel")
    .door("b4bath", "east", 4, 2.5, "flush")
    .door("lng", "west", 12, 3, "panel")
    .door("uhall", "west", 3, 3, "panel")
    .door("mst", "north", 7, 3, "panel")
    .door("rbal", "north", 7, 5, "sliding")
    .door("mstudy", "west", 4, 3, "panel")
    .door("mstudy", "north", 3, 3, "panel")
    .door("wiw", "west", 2.25, 2.5, "sliding")
    .door("mbath", "west", 6.25, 2.5, "flush")
    .door("bed2", "north", 7.5, 3, "panel")
    .door("b2bath", "north", 1.75, 2.5, "flush");
  b.window("bed3", "north", 5, 5, "casement", 4.5, 2.5)
    .window("bed3", "west", 6, 4, "casement", 4.5, 2.5)
    .window("b3bath", "north", 3, 2, "awning", 2, 5)
    .window("b4bath", "north", 4, 2, "awning", 2, 5)
    .window("bed4", "north", 5, 5, "casement", 4.5, 2.5)
    .window("bed4", "east", 6, 4, "casement", 4.5, 2.5)
    .window("gal", "south", 4, 3, "casement")
    .window("gal", "south", 10, 3, "casement")
    .window("sr1", "west", 9.5, 3, "casement")
    .window("lng", "east", 7, 5, "casement", 4.5, 2.5)
    .window("lng", "west", 5, 4, "casement", 4.5, 2.5)
    .window("uhall", "north", 7, 4, "casement")
    .window("mst", "south", 11.5, 3, "casement", 4.5, 2.5)
    .window("mstudy", "east", 3.25, 4, "casement", 4.5, 2.5)
    .window("wiw", "south", 2.5, 2, "casement", 2, 5)
    .window("mbath", "east", 4, 2.5, "awning", 2, 5)
    .window("mbath", "south", 2.5, 2, "awning", 2, 5)
    .window("bed2", "west", 4, 4, "casement", 4.5, 2.5)
    .window("b2bath", "west", 2.5, 2, "awning", 2, 5);
  // Furniture
  furnishLiving(b, "liv", { sofa: "sofa-l" });
  furnishDining(b, "din", { x: 32.5, y: 37, alongX: false });
  furnishKitchen(b, "kit");
  compactBedroom(b, "gst");
  furnishBathroom(b, "gbath");
  furnishStudy(b, "study");
  furnishBedroom(b, "mst", { bed: "bed-king", walkIn: true });
  furnishBathroom(b, "mbath");
  furnishStudy(b, "mstudy");
  compactBedroom(b, "bed2");
  furnishBathroom(b, "b2bath");
  furnishBedroom(b, "bed3", { bed: "bed-queen", desk: true });
  furnishBathroom(b, "b3bath");
  furnishBedroom(b, "bed4", { bed: "bed-queen" });
  furnishBathroom(b, "b4bath");
  furnishLiving(b, "lng", { sofa: "sofa-2" });
  b.trySomewhere("wiw", "wardrobe-2", { sides: ["east"] });
  b.trySomewhere("wiw", "chest-drawers", { sides: ["west", "south"] });
  b.trySomewhere("wiw", "floor-mirror");
  b.trySomewhere("store", "store-rack");
  b.trySomewhere("util", "washer-front", { sides: ["south"] });
  b.trySomewhere("util", "dryer", { sides: ["south"] });
  b.trySomewhere("util", "storage-cabinet", { sides: ["west"] });
  b.trySomewhere("foy", "shoe-rack");
  b.trySomewhere("foy", "console");
  b.trySomewhere("pwd", "wc");
  b.trySomewhere("pwd", "basin");
  b.put("park", "car-suv", 7, 10, 180);
  b.put("park", "car-sedan", 14, 10, 180);
  if (o.twoWheelers) {
    b.put("park", "motorcycle", 19.25, 10, 180);
    b.put("park", "scooter", 22.25, 10, 180);
  }
  b.trySomewhere("park", "ev-charger");
  // The lawn keeps a clear path from the wicket gate to the porch.
  b.put("lawn", "shade-tree", 34, 6.5);
  b.put("lawn", "shrub", 26, 4, 0, true);
  b.put("lawn", "shrub", 35.5, 11.5, 0, true);
  b.put("lawn", "garden-lamp", 28, 9, 0, true);
  b.put("lawn", "garden-lamp", 30.5, 11.5, 0, true);
  b.trySomewhere("porch", "bench", { sides: ["east"] });
  b.trySomewhere("porch", "plant-floor");
  landscape(b, "court", ["tulsi", "areca-palm", "planter", "garden-lamp"]);
  for (const id of ["patio-chair", "patio-chair", "planter"]) b.trySomewhere("fbal", id);
  for (const id of ["patio-chair", "patio-chair", "planter"]) b.trySomewhere("rbal", id);
  for (const [id, f] of [["liv", "marble"], ["din", "marble"], ["foy", "granite"], ["hall", "granite"], ["gal", "granite"], ["uhall", "granite"], ["sr", "granite"], ["sr1", "granite"], ["kit", "vitrified"], ["mst", "wood"], ["bed2", "laminate"], ["bed3", "laminate"], ["bed4", "laminate"], ["gst", "vitrified"], ["study", "wood"], ["lng", "vitrified"], ["court", "grass"], ["lawn", "grass"], ["park", "concrete"], ["porch", "outdoor-tile"]] as const) b.flooring(id, f);
}
