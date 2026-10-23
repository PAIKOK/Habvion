import { check } from "../check.js";
import { createDesign } from "@shared/design/createDesign";
import { applyAction } from "@shared/design/reducer";
import { auditDesign, reachability, roomBeyond, opensOutside, allIssues } from "@shared/design/audit";
import type { HomeDesign, Room, Side } from "@shared/types/home";

let d: HomeDesign = createDesign({ width: 40, length: 60, floors: 2 });
const go = (a: Parameters<typeof applyAction>[1]) => {
  const r = applyAction(d, a);
  if (!r.applied) console.log("  refused:", a.type, r.issues.map((i) => i.message).join("; "));
  else d = r.design;
  return r;
};
const room = (id: string, type: Room["type"], x: number, y: number, width: number, length: number, floor = 0) =>
  go({ type: "room/add", room: { id, name: id, type, x, y, width, length, floor } });
let n = 0;
const door = (roomId: string, side: Side, offset: number, width = 3) =>
  go({ type: "door/add", door: { id: `d${n++}`, roomId, side, offset, width, height: 7, doorType: "panel", swing: "left" } });
const win = (roomId: string, side: Side, offset: number, width = 3) =>
  go({ type: "window/add", window: { id: `w${n++}`, roomId, side, offset, width, height: 4, windowType: "casement", sill: 3 } });
/*
 *  x: 5        15        25       35
 *  y=6  foyer | living  | kitchen
 *  y=18 hall (5..35, 4 ft)
 *  y=22 bed1 | bath1 | bed2
 */
room("foyer", "foyer", 5, 6, 10, 12);
room("living", "living", 15, 6, 12, 12);
room("kitchen", "kitchen", 27, 6, 8, 12);
room("hall", "hall", 5, 18, 30, 4);
room("bed1", "bedroom", 5, 22, 12, 12);
room("bath1", "attached-bathroom", 17, 22, 6, 8);
room("bed2", "bedroom", 23, 22, 12, 12);
door("foyer", "north", 5);
door("foyer", "east", 6);
door("living", "east", 6);
door("hall", "north", 5);
door("hall", "south", 6);
door("bed1", "east", 3);
for (const [r, s, o] of [["foyer", "west", 6], ["living", "north", 6], ["kitchen", "north", 4], ["bed1", "west", 6], ["bath1", "south", 3], ["bed2", "east", 6]] as const)
  win(r, s, o);
check("the entrance door leads outside", roomBeyond(d, d.doors[0]!) === null);
check("an internal door joins two rooms", roomBeyond(d, d.doors[1]!)?.id === "living");
let reach = reachability(d);
check("rooms behind halls and shared rooms are reached", ["foyer", "living", "kitchen", "hall", "bed1"].every((id) => reach.reached.has(id)));
check("a bathroom hanging off a bedroom is reached", reach.reached.has("bath1"));
check("a bedroom with no door is unreached", !reach.reached.has("bed2"));
check("the audit names it", auditDesign(d).some((i) => i.code === "room/no-hall-access" && i.entityIds?.includes("bed2")));
// bed2 only through bed1: still not allowed — the walk stops at private rooms.
go({ type: "door/add", door: { id: "via-bed", roomId: "bath1", side: "east", offset: 4, width: 2.5, height: 7, doorType: "panel", swing: "left" } });
reach = reachability(d);
check("a bedroom reached only through another bedroom's bathroom is flagged", !reach.reached.has("bed2"));
go({ type: "door/delete", id: "via-bed" });
door("hall", "south", 24);
check("a hall door fixes it", reachability(d).reached.has("bed2"));
check("windows to the outside count", opensOutside(d, d.windows[0]!));
go({ type: "window/delete", id: d.windows.find((w) => w.roomId === "bath1")!.id });
check("a wet room without a window is an error", auditDesign(d).some((i) => i.code === "room/wet-no-window" && i.level === "error"));
win("bath1", "south", 3);
check("services: kitchen and bathroom present", !auditDesign(d).some((i) => i.code.startsWith("services/no-")));
go({ type: "parking/need", need: "1-car" });
check("missing parking is an error", auditDesign(d).some((i) => i.code === "services/parking"));
room("park", "parking", 5, 40, 11, 16);
check("parking satisfied", !auditDesign(d).some((i) => i.code === "services/parking"));
// Upstairs: a stair from the hall... put a stair room on the ground floor.
room("core", "staircase", 25, 40, 10, 16);
door("core", "north", 5);
go({ type: "room/update", id: "hall", patch: {} });
room("lobby", "hall", 25, 40, 10, 16, 1);
room("ter1", "terrace", 5, 6, 10, 12, 1);
room("ter2", "terrace", 15, 6, 12, 12, 1);
go({
  type: "stair/add",
  stair: { id: "st", x: 26, y: 41, width: 7, length: 11, fromFloor: 0, toFloor: 1, direction: "north", stairType: "dog-legged", turn: "left" },
});
check("stair core with a door to the outside... reached", reachability(d).reached.has("core"));
check("the stair reaches the upstairs lobby", reachability(d).reached.has("lobby"));
check("a dog-legged stair arriving inside the lobby is fine", !auditDesign(d).some((i) => i.code.startsWith("stair/")));
check("terraces with no door upstairs are unreached", !reachability(d).reached.has("ter1"));
go({ type: "room/update", id: "lobby", patch: { length: 13 } });
check("cramming the lobby: the arrival crosses a wall", auditDesign(d).some((i) => i.code === "stair/arrives-at-wall"));
go({ type: "room/update", id: "lobby", patch: { length: 16, type: "bedroom" } });
check("arriving in a bedroom is flagged", auditDesign(d).some((i) => i.code === "stair/arrives-in-private-room"));
go({ type: "room/update", id: "lobby", patch: { type: "hall" } });
go({ type: "room/update", id: "ter2", patch: { x: 15 } });
go({ type: "room/add", room: { id: "ter3", name: "ter3", type: "terrace", x: 15, y: 18, width: 20, length: 22, floor: 1 } });
go({ type: "door/add", door: { id: "lob", roomId: "lobby", side: "north", offset: 2, width: 3, height: 7, doorType: "panel", swing: "left" } });
reach = reachability(d);
check("open edges join neighbouring terraces", reach.reached.has("ter3") && reach.reached.has("ter2") && reach.reached.has("ter1"));
check("allIssues puts errors first", (() => {
  const all = allIssues(d);
  const firstWarn = all.findIndex((i) => i.level === "warning");
  return firstWarn === -1 || all.slice(firstWarn).every((i) => i.level === "warning");
})());
