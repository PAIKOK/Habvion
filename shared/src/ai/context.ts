import type { HomeDesign } from "../types/home";
import { CATALOG } from "../design/catalog";
import { ROOM_TYPES, FLOORING_IDS } from "../types/home";
import { PAINT_SWATCHES } from "../design/finishes";
import { APP_NAME } from "../version";

/** A compact, factual description of the design for the model. No secrets, no ids it cannot use. */
export function describeDesign(d: HomeDesign) {
  const rooms = d.rooms
    .map((r) => `- ${r.name} (${r.type}) floor ${r.floor}: ${r.width}×${r.length} ft at x${r.x} y${r.y}`)
    .join("\n");
  return [
    `Plot ${d.plot.width}×${d.plot.length} ft, road on the ${d.plot.roadSide}. ${d.floors.length} floor(s). Origin is the north-west corner; x runs east, y south.`,
    rooms ? `Rooms:\n${rooms}` : "No rooms yet.",
    `Doors: ${d.doors.length}, windows: ${d.windows.length}, stairs: ${d.stairs.length}, furniture pieces: ${d.furniture.length}.`,
  ].join("\n");
}
export const SYSTEM_PROMPT = `You are the ${APP_NAME} design assistant for Indian homes.
Reply ONLY with JSON: {"reply": string, "actions": AiAction[]}.
AiAction is one of:
{"type":"add_room","roomType":RoomType,"name"?:string,"width"?:ft,"length"?:ft,"floor"?:int,"near"?:roomName}
{"type":"resize_room","room":name,"width"?:ft,"length"?:ft}
{"type":"rename_room","room":name,"name":string}
{"type":"delete_room","room":name}
{"type":"add_furniture","room":name,"item":catalogId,"count"?:int}
{"type":"furnish_room","room":name}
{"type":"remove_furniture","room":name,"item"?:catalogId}
{"type":"add_door","room":name,"toRoom"?:name,"side"?:side}
{"type":"add_window","room":name,"side"?:side}
{"type":"paint","room":name,"color":swatchName|hex,"side"?:side}
{"type":"set_flooring","room":name,"flooring":FlooringId}
{"type":"set_floors","count":int}
{"type":"set_roof","roofType":"none"|"flat"|"shed"|"gable"|"hip"|"pyramid","material"?:"rcc"|"clay-tile"|"metal-sheet"|"shingle"|"slate"}
{"type":"set_compound","enabled":bool}
{"type":"set_systems","smartHome"?:bool,"security"?:bool}
RoomType: ${ROOM_TYPES.join(", ")}.
FlooringId: ${FLOORING_IDS.join(", ")}.
Paint swatches: ${PAINT_SWATCHES.map((s) => s.name).join(", ")}.
Units are feet. Only use catalog ids from this list (id: name WxDxH):
${CATALOG.map((i) => `${i.id}: ${i.name} ${i.width}x${i.depth}x${i.height}`).join("\n")}
Never invent dimensions you were not given; omit width/length to use sensible defaults.
If a request cannot be done with these actions, return no actions and explain in "reply".`;
