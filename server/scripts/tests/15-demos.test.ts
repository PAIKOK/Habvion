import { check } from "../check.js";
import { DEMOS, buildDemo } from "@shared/design/demos";
import { demoFacts } from "@shared/design/demos/facts";
import { WET_ROOMS, allIssues, arrivalRoom, opensOutside, reachability, roleOf, roomBeyond } from "@shared/design/audit";
import { arrivalsOf } from "@shared/design/stairs";
import { itemFor } from "@shared/design/catalog";
import { doorClearZones, validateFurniture } from "@shared/design/furniture";
import { validateDesign } from "@shared/design/validation";
import { isOpenAir } from "@shared/design/roomTypes";
import { startApp } from "../http.js";

check("six demo homes", DEMOS.length === 6);
check("demo route ids are unique", new Set(DEMOS.map((d) => d.id)).size === DEMOS.length);
for (const demo of DEMOS) {
  const t = performance.now(),
    { design: d, refusals } = demo.build(),
    ms = performance.now() - t,
    name = demo.title,
    pieces = (roomId: string) => d.furniture.filter((f) => f.roomId === roomId),
    has = (roomId: string, ids: string[]) => pieces(roomId).some((f) => ids.includes(f.catalogId)),
    category = (roomId: string, c: string) => pieces(roomId).some((f) => itemFor(d, f.catalogId)?.category === c);
  check(`${name}: builds in under 3 s`, ms < 3000, `${Math.round(ms)} ms`);
  check(`${name}: zero refusals`, refusals.length === 0, refusals.join(" | "));
  check(`${name}: the design validates`, validateDesign(d).ok);
  const issues = allIssues(d);
  check(`${name}: zero audit errors`, !issues.some((i) => i.level === "error"), issues.filter((i) => i.level === "error").map((i) => i.message).join(" | "));
  check(`${name}: zero warnings`, issues.length === 0, issues.map((i) => i.message).join(" | "));

  // Circulation
  const { reached } = reachability(d);
  check(`${name}: every room is reachable`, d.rooms.every((r) => reached.has(r.id)), d.rooms.filter((r) => !reached.has(r.id)).map((r) => r.name).join(", "));
  for (const s of d.stairs)
    for (const a of arrivalsOf(d, s)) {
      const { room, cover } = arrivalRoom(d, s.toFloor, a);
      check(`${name}: stair ${s.id} lands in a hall or shared room`, !!room && cover >= 0.95 && ["circulation", "shared"].includes(roleOf(room.type)), room ? `${room.name} ${Math.round(cover * 100)}%` : "nowhere");
    }
  // Upstairs, no door's swing or landing strip falls on a stair's arrival.
  for (const s of d.stairs)
    for (const a of arrivalsOf(d, s)) {
      const blocked = d.doors.filter((o) => {
        const owner = d.rooms.find((r) => r.id === o.roomId)!;
        return owner.floor === s.toFloor && doorClearZones(d, o).some((z) => z.x < a.x + a.width - 0.01 && a.x < z.x + z.width - 0.01 && z.y < a.y + a.length - 0.01 && a.y < z.y + z.length - 0.01);
      });
      check(`${name}: no door opens onto stair ${s.id}'s landing`, blocked.length === 0, blocked.map((o) => o.id).join(", "));
    }
  // Air and light
  for (const r of d.rooms.filter((r) => WET_ROOMS.includes(r.type) && ["bathroom", "attached-bathroom", "powder", "kitchen"].includes(r.type)))
    check(`${name}: ${r.name} has an outside window`, d.windows.some((o) => o.roomId === r.id && opensOutside(d, o)));
  // Site
  const cars = d.furniture.filter((f) => f.catalogId.startsWith("car-")),
    widest = Math.max(0, ...cars.map((f) => itemFor(d, f.catalogId)!.width));
  check(`${name}: a vehicle gate wider than the car`, !!d.compound?.gate && d.compound.gate.width > widest + 2, `${d.compound?.gate?.width} vs ${widest}`);

  // Quality checklist
  for (const r of d.rooms) {
    check(`${name}: ${r.name} is lit`, category(r.id, "lighting"));
    check(`${name}: ${r.name} is furnished`, pieces(r.id).some((f) => itemFor(d, f.catalogId)?.category !== "lighting") || ["hall", "staircase"].includes(r.type));
  }
  for (const k of d.rooms.filter((r) => r.type === "kitchen")) {
    const missing = ["fridge", "sink", "hob", "chimney", "counter"].filter((what) =>
      !pieces(k.id).some((f) => (what === "counter" ? itemFor(d, f.catalogId)?.shape === "counter" : f.catalogId.includes(what))),
    );
    check(`${name}: ${k.name} has fridge, sink, hob, chimney and counter`, missing.length === 0, missing.join(", "));
    const worktop = pieces(k.id).filter((f) => itemFor(d, f.catalogId)?.mount === "surface" && !["kitchen-sink", "hob"].includes(f.catalogId));
    check(`${name}: ${k.name} has at least three things on the worktop`, worktop.length >= 3, worktop.map((f) => f.catalogId).join(", "));
  }
  for (const r of d.rooms.filter((r) => r.type.includes("bedroom"))) {
    check(`${name}: ${r.name} has a bed`, pieces(r.id).some((f) => itemFor(d, f.catalogId)?.shape === "bed"));
    // Storage in the room, or in a walk-in wardrobe that opens off it.
    const walkIns = d.rooms.filter((w) => w.type === "walk-in-wardrobe" && d.doors.some((o) => (o.roomId === w.id && roomBeyond(d, o)?.id === r.id) || (o.roomId === r.id && roomBeyond(d, o)?.id === w.id)));
    const storage = [r, ...walkIns].some((x) => pieces(x.id).some((f) => itemFor(d, f.catalogId)?.category === "storage"));
    check(`${name}: ${r.name} has storage`, storage);
  }
  for (const r of d.rooms.filter((r) => ["bathroom", "attached-bathroom", "powder"].includes(r.type))) {
    check(`${name}: ${r.name} has a WC`, has(r.id, ["wc", "wc-wall", "indian-wc"]));
    check(`${name}: ${r.name} has a basin`, has(r.id, ["basin", "vanity", "vanity-double"]));
  }
  const floating = d.furniture.filter((f) => validateFurniture(d, f).issues.some((i) => i.code === "furniture/unsupported"));
  check(`${name}: nothing floats`, floating.length === 0, floating.map((f) => f.id).join(", "));
  check(`${name}: every piece sits in a room that exists`, d.furniture.every((f) => d.rooms.some((r) => r.id === f.roomId && r.floor === f.floor)));
  check(`${name}: open-air rooms are never roofed rooms`, d.rooms.filter((r) => isOpenAir(r.type)).every((r) => !r.type.includes("bedroom")));
}

// The spec's particulars, counted from the designs.
{
  const facts = (id: string) => demoFacts(buildDemo(id)!.design),
    rooms = (id: string) => buildDemo(id)!.design.rooms;
  const urban = facts("smart-urban-home");
  check("Smart Urban Home: 20×40, two floors, three bedrooms", urban.plot.width === 20 && urban.plot.length === 40 && urban.floors === 2 && urban.bedrooms === 3);
  check("Smart Urban Home: the car is under the first floor", rooms("smart-urban-home").some((r) => r.floor === 1 && r.type.includes("bedroom") && r.y < 14 && r.x >= 8.75));
  const lux = facts("luxury-courtyard-villa");
  check("Luxury Courtyard Villa: 40×60, three levels, five bedrooms", lux.plot.width === 40 && lux.floors === 3 && lux.bedrooms === 5);
  check("Luxury Courtyard Villa: courtyard, theatre and gym", ["courtyard", "home-theatre", "gym"].every((t) => rooms("luxury-courtyard-villa").some((r) => r.type === t)));
  const indian = buildDemo("indian-standard-home")!.design,
    at = (type: string) => indian.rooms.find((r) => r.type === type)!,
    cx = (r: { x: number; width: number }) => r.x + r.width / 2,
    cy = (r: { y: number; length: number }) => r.y + r.length / 2;
  check("Indian Standard Home: 30×40, north road", indian.plot.width === 30 && indian.plot.length === 40 && indian.plot.roadSide === "north");
  check("Indian Standard Home: pooja in the north-east", cx(at("pooja")) > 15 && cy(at("pooja")) < 20);
  check("Indian Standard Home: kitchen in the south-east", cx(at("kitchen")) > 15 && cy(at("kitchen")) > 20);
  check("Indian Standard Home: master bedroom in the south-west", cx(at("master-bedroom")) < 15 && cy(at("master-bedroom")) > 20);
  const cc = facts("contemporary-courtyard"),
    ccRooms = rooms("contemporary-courtyard");
  check("Contemporary Courtyard: 5 bed / 5 bath + powder", cc.bedrooms === 5 && cc.bathrooms === 5 && cc.powderRooms === 1);
  check("Contemporary Courtyard: 2 cars + 2 two-wheelers", cc.parking === "2 cars + 2 two-wheelers");
  check("Contemporary Courtyard: a staircase room on every level", [0, 1, 2].every((f) => ccRooms.some((r) => r.floor === f && r.type === "staircase")));
  check("Contemporary Courtyard: master suite has a walk-in and a study", ["walk-in-wardrobe", "study"].every((t) => ccRooms.some((r) => r.floor === 1 && r.type === t)));
  check("Contemporary Courtyard: front and rear balconies, family lounge", ccRooms.filter((r) => r.type === "balcony").length === 2 && ccRooms.some((r) => r.type === "family"));
  const terrace = buildDemo("contemporary-courtyard")!.design.furniture.filter((f) => ccRooms.find((r) => r.id === f.roomId)?.type === "terrace").map((f) => f.catalogId);
  check("Contemporary Courtyard: terrace with pergola, BBQ, water tank and solar", ["pergola", "bbq", "water-tank", "solar"].every((id) => terrace.includes(id)));
  check("Contemporary Courtyard: a lawn on the terrace", buildDemo("contemporary-courtyard")!.design.flooring.terr === "grass");
  const g = buildDemo("contemporary-courtyard")!.design.compound!;
  check("Contemporary Courtyard: sliding vehicle gate and a pedestrian gate", g.gate.kind === "sliding" && !!g.pedestrianGate);
}

// The sixth demo must match its advertised brief, not just appear as another card.
{
  const d = buildDemo("garden-bungalow")!.design,
    facts = demoFacts(d),
    garden = d.rooms.find((r) => r.type === "garden"),
    bath = d.rooms.find((r) => r.id === "bath"),
    bedroomDoors = d.doors.filter((o) => d.rooms.find((r) => r.id === o.roomId)?.type.includes("bedroom"));
  check("Garden Bungalow: 40×60, one floor, three bedrooms and two baths", facts.plot.width === 40 && facts.plot.length === 60 && facts.floors === 1 && facts.bedrooms === 3 && facts.bathrooms === 2);
  check("Garden Bungalow: a furnished grass garden", !!garden && d.flooring[garden.id] === "grass" && d.furniture.some((f) => f.roomId === garden.id && f.catalogId === "shade-tree"));
  check("Garden Bungalow: one car with a separate pedestrian gate", facts.cars === 1 && facts.parking === "1 car" && !!d.compound?.pedestrianGate);
  check("Garden Bungalow: a flat roof, open garden courtyard and no stairs", d.roof?.type === "flat" && d.rooms.some((r) => r.type === "courtyard") && d.stairs.length === 0);
  check("Garden Bungalow: every bedroom opens from a hall", bedroomDoors.length === 3 && bedroomDoors.every((o) => roomBeyond(d, o)?.type === "hall"));
  check("Garden Bungalow: the common bath opens from the guest lobby", !!bath && d.doors.some((o) => o.roomId === bath.id && roomBeyond(d, o)?.id === "lobby"));
  check("Garden Bungalow: circulation halls contain no floor furniture", !d.furniture.some((f) => ["hall", "lobby"].includes(f.roomId) && itemFor(d, f.catalogId)?.mount === "floor"));
}

// The public API serves cards and designs without anyone signed in.
{
  const app = await startApp();
  try {
    const list = await app.client().call("/demos");
    check("GET /api/demos is public", list.status === 200);
    const demos = (list.json as { demos: { id: string; facts: { estimate: number; outline: unknown[] } }[] }).demos;
    check("GET /api/demos lists all six with facts", demos.length === 6 && demos.every((d) => d.facts.estimate > 0 && d.facts.outline.length > 0));
    const one = await app.client().call("/demos/smart-urban-home");
    check("GET /api/demos/:id returns a valid design", one.status === 200 && validateDesign((one.json as { design: never }).design).ok);
    const bungalow = await app.client().call("/demos/garden-bungalow");
    const newDesign = (bungalow.json as { design: import("@shared/types/home").HomeDesign }).design;
    check("GET /api/demos/garden-bungalow returns the new valid design", bungalow.status === 200 && newDesign.name === "Garden Bungalow" && validateDesign(newDesign).ok && demoFacts(newDesign).bedrooms === 3);
    check("GET /api/demos/:id for an unknown id is 404", (await app.client().call("/demos/nope")).status === 404);
  } finally {
    await app.close();
  }
}
