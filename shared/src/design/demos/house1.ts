import { HouseBuilder, type BuildResult } from "./builder";
import { furnishBathroom, furnishBedroom, furnishDining, furnishKitchen, furnishLiving, furnishStudy, landscape, lightRooms } from "./archetypes";

/**
 * Modern Family Villa — 30×50, north road, two floors, 4 BHK.
 * Ground: car porch, porch, living, stair lobby, dining, kitchen, guest suite.
 * First: three bedrooms (master with bath and walk-in), family lounge, study, balcony.
 */
export function modernFamilyVilla(): BuildResult {
  const b = new HouseBuilder({ id: "demo-modern-family-villa", name: "Modern Family Villa", width: 30, length: 50, floors: 2, roadSide: "north", parkingNeed: "1-car" });
  b.setbacks(5, 2, 2, 2);
  // Ground floor
  b.addRoom("park", "Car porch", "parking", 2, 5, 10, 15)
    .addRoom("porch", "Porch", "porch", 12, 5, 7, 4)
    .addRoom("liv", "Living room", "living", 12, 9, 16, 11)
    .addRoom("lob", "Stair lobby", "hall", 2, 20, 16, 12)
    .addRoom("din", "Dining", "dining", 18, 20, 10, 12)
    .addRoom("gst", "Guest bedroom", "guest-bedroom", 2, 32, 10, 11)
    .addRoom("gbath", "Guest bath", "attached-bathroom", 2, 43, 10, 5)
    .addRoom("store", "Store", "store", 12, 32, 4, 16)
    .addRoom("kit", "Kitchen", "kitchen", 16, 32, 12, 11)
    .addRoom("util", "Utility", "utility", 16, 43, 12, 5);
  b.stair("st1", 6, 23, 11, 7, 0, "east", "dog-legged", "right");
  b.door("liv", "north", 4, 3.5, "panel")
    .door("liv", "south", 3, 3, "panel")
    .door("liv", "south", 11, 5, "french")
    .door("lob", "north", 5, 3, "panel")
    .door("din", "west", 2, 3, "panel")
    .door("kit", "north", 7, 3, "panel")
    .door("store", "east", 3, 2.5, "flush")
    .door("util", "north", 2, 2.5, "flush")
    .door("util", "east", 2.5, 3, "flush")
    .door("gst", "north", 2.25, 2.75, "panel")
    .door("gbath", "north", 8.25, 2.5, "flush");
  b.window("liv", "north", 12.5, 5, "casement", 4.5, 2.5)
    .window("liv", "east", 5.5, 5, "casement", 4.5, 2.5)
    .window("lob", "west", 8, 3, "casement")
    .window("din", "east", 6, 5, "sliding", 4.5, 2.5)
    .window("kit", "east", 5.5, 4, "sliding", 3.5, 3.5)
    .window("util", "south", 6, 3, "awning", 2.5, 4.5)
    .window("gst", "west", 5.5, 5, "casement", 4.5, 2.5)
    .window("gbath", "west", 2.5, 2, "awning", 2, 5);
  // First floor
  b.addRoom("hall1", "Upper hall", "hall", 2, 20, 16, 12, 1)
    .addRoom("bed2", "Bedroom 2", "bedroom", 2, 5, 10, 15, 1)
    .addRoom("mst", "Master bedroom", "master-bedroom", 12, 5, 10, 15, 1)
    .addRoom("mbath", "Master bath", "attached-bathroom", 22, 5, 6, 7, 1)
    .addRoom("wiw", "Walk-in wardrobe", "walk-in-wardrobe", 22, 12, 6, 8, 1)
    .addRoom("lng", "Family lounge", "family", 18, 20, 10, 12, 1)
    .addRoom("bed3", "Bedroom 3", "bedroom", 2, 32, 10, 11, 1)
    .addRoom("b3bath", "Bedroom 3 bath", "attached-bathroom", 2, 43, 10, 5, 1)
    .addRoom("study", "Study", "study", 12, 32, 10, 8, 1)
    .addRoom("bath2", "Common bath", "bathroom", 22, 32, 6, 8, 1)
    .addRoom("balc", "Rear balcony", "balcony", 12, 40, 16, 8, 1);
  b.door("bed2", "south", 7, 3, "panel")
    .door("mst", "south", 4.5, 3, "panel")
    .door("mbath", "west", 4.5, 2.5, "flush")
    .door("wiw", "west", 2, 2.5, "sliding")
    .door("lng", "west", 2, 3, "panel")
    .door("bed3", "north", 2.25, 2.75, "panel")
    .door("b3bath", "north", 8.25, 2.5, "flush")
    .door("study", "north", 8, 2.75, "panel")
    .door("bath2", "north", 3, 2.5, "flush")
    .door("balc", "north", 3, 3.5, "sliding");
  b.window("bed2", "north", 5, 5, "casement", 4.5, 2.5)
    .window("bed2", "west", 7.5, 4, "casement", 4.5, 2.5)
    .window("mst", "north", 5, 6, "bay", 4.5, 2.5)
    .window("mbath", "north", 3, 2, "awning", 2, 5)
    .window("lng", "east", 6, 5, "casement", 4.5, 2.5)
    .window("hall1", "west", 8, 3, "casement")
    .window("bed3", "west", 5.5, 5, "casement", 4.5, 2.5)
    .window("b3bath", "west", 2.5, 2, "awning", 2, 5)
    .window("study", "south", 7.5, 3, "casement")
    .window("bath2", "east", 4, 2, "awning", 2, 5);
  // Site and finishes
  b.walled({ offset: 7, width: 10, kind: "sliding" }, { offset: 15.5, width: 3.5 });
  b.roof("flat", "rcc").systems(true, true);
  for (const [id, f] of [["liv", "marble"], ["din", "marble"], ["lob", "granite"], ["hall1", "granite"], ["kit", "vitrified"], ["mst", "wood"], ["bed2", "laminate"], ["bed3", "laminate"], ["gst", "vitrified"], ["study", "wood"], ["lng", "vitrified"]] as const) b.flooring(id, f);
  b.paint("liv", "#f4efe4").paintWall("liv", "east", "#2f6f73").paint("mst", "#e7c3b5").paint("bed2", "#cfe5d6").paint("bed3", "#e8d9bf").paint("lng", "#f4efe4");
  // Furniture
  furnishLiving(b, "liv");
  furnishDining(b, "din");
  furnishKitchen(b, "kit");
  furnishBedroom(b, "gst", { bed: "bed-queen" });
  furnishBathroom(b, "gbath");
  furnishBedroom(b, "mst", { bed: "bed-king", wardrobe: "wardrobe-3" });
  furnishBathroom(b, "mbath");
  furnishBedroom(b, "bed2", { bed: "bed-queen", desk: true });
  furnishBedroom(b, "bed3", { bed: "bed-queen" });
  furnishBathroom(b, "b3bath");
  furnishBathroom(b, "bath2");
  furnishStudy(b, "study");
  furnishLiving(b, "lng", { sofa: "sofa-2" });
  b.trySomewhere("wiw", "wardrobe-sliding") ?? b.trySomewhere("wiw", "wardrobe-3");
  b.trySomewhere("wiw", "floor-mirror");
  b.trySomewhere("store", "store-rack");
  b.trySomewhere("store", "store-rack");
  b.trySomewhere("util", "washer-front", { sides: ["south"] });
  b.trySomewhere("util", "counter-4", { sides: ["south"] });
  b.trySomewhere("lob", "shoe-rack");
  b.trySomewhere("lob", "console");
  b.put("park", "car-hatch", 7, 11.5, 180);
  b.trySomewhere("park", "scooter");
  b.trySomewhere("porch", "plant-floor");
  for (const id of ["outdoor-sofa", "planter", "planter", "plant-floor"]) b.trySomewhere("balc", id);
  lightRooms(b);
  return b.result();
}
