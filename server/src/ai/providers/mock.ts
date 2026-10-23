import type { HomeDesign, Room, RoomType } from "@shared/types/home";
import { ROOM_TYPES } from "@shared/types/home";
import { CATALOG } from "@shared/design/catalog";
import { PAINT_SWATCHES, FLOORING_INFO } from "@shared/design/finishes";
import type { AiProvider, PlanRequest } from "./provider.js";

/** Words people use for each room type, longest first so "master bedroom" wins over "bedroom". */
const ROOM_WORDS: [string, RoomType][] = (
  [
    ...ROOM_TYPES.map((t) => [t.replace(/-/g, " "), t] as [string, RoomType]),
    ["bath", "bathroom"],
    ["toilet", "powder"],
    ["washroom", "bathroom"],
    ["living room", "living"],
    ["hall", "living"],
    ["drawing room", "living"],
    ["office", "home-office"],
    ["prayer room", "pooja"],
    ["puja", "pooja"],
    ["car park", "parking"],
    ["theatre", "home-theatre"],
    ["master", "master-bedroom"],
  ] as [string, RoomType][]
).sort((a, b) => b[0].length - a[0].length);
const NUMBERS: Record<string, number> = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function mentionedRooms(d: HomeDesign, text: string): Room[] {
  const hits: { room: Room; at: number; len: number }[] = [];
  for (const r of d.rooms) {
    const name = r.name.toLowerCase(),
      at = text.indexOf(name);
    if (at >= 0) hits.push({ room: r, at, len: name.length });
  }
  for (const [word, type] of ROOM_WORDS) {
    const at = text.search(new RegExp(`\\b${word}\\b`));
    const room = d.rooms.find((r) => r.type === type);
    if (at >= 0 && room && !hits.some((h) => h.room.id === room.id || (at >= h.at && at < h.at + h.len))) hits.push({ room, at, len: word.length });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.room);
}
/** A catalog item named in the text: full name first, then its id or last word, plurals allowed. */
function itemIn(text: string) {
  const words = (s: string) => new RegExp(`\\b${s.replace(/[-_]/g, " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(e?s)?\\b`).test(text);
  const byLength = [...CATALOG].sort((a, b) => b.name.length - a.name.length);
  return (
    byLength.find((i) => words(i.name.toLowerCase())) ??
    byLength.find((i) => words(i.id)) ??
    byLength.find((i) => words(i.name.toLowerCase().split(" ").at(-1)!))
  );
}
const roomTypeIn = (text: string) => ROOM_WORDS.find(([w]) => new RegExp(`\\b${w}\\b`).test(text))?.[1];

/**
 * A deterministic keyword planner for development and tests. It needs no key and no
 * network, and it emits the same JSON contract a real model would.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock";
  async plan({ message, design }: PlanRequest): Promise<unknown> {
    const actions: Record<string, unknown>[] = [];
    for (const raw of message.toLowerCase().split(/(?:\.|;|,| and then | then | and (?=add|paint|furnish|put|make|remove|delete|give|set))\s*/)) {
      const text = raw.trim();
      if (!text) continue;
      const rooms = mentionedRooms(design, text),
        room = rooms[0]?.name;
      const floors = text.match(/(\w+)\s+(?:floors|storeys|stories)/);
      if (floors && /\b(make|set|build|want|need)\b|floors? house/.test(text)) {
        const n = Number(floors[1]) || NUMBERS[floors[1]!];
        if (n) actions.push({ type: "set_floors", count: n });
        continue;
      }
      const roof = text.match(/\b(flat|shed|gable|hip|pyramid)\b.*\broof\b|\bno roof\b/);
      if (roof) {
        actions.push({ type: "set_roof", roofType: roof[1] ?? "none" });
        continue;
      }
      if (/compound|boundary wall/.test(text)) {
        actions.push({ type: "set_compound", enabled: !/\b(remove|no|without)\b/.test(text) });
        continue;
      }
      if (/smart home|cctv|security/.test(text)) {
        actions.push({ type: "set_systems", ...(/smart/.test(text) ? { smartHome: true } : {}), ...(/cctv|security/.test(text) ? { security: true } : {}) });
        continue;
      }
      if (/\bfurnish\b/.test(text)) {
        const targets = /\b(every|all|each|whole)\b/.test(text) ? design.rooms : rooms;
        for (const r of targets) actions.push({ type: "furnish_room", room: r.name });
        continue;
      }
      if (/\bpaint\b|\bcolou?r\b/.test(text) && room) {
        const hex = text.match(/#[0-9a-f]{6}/)?.[0],
          swatch = PAINT_SWATCHES.find((s) => text.includes(s.name.toLowerCase()))?.name,
          word = text.match(/\b(white|cream|beige|orange|yellow|green|teal|blue|pink|grey|gray|black|red)\b/)?.[1];
        const color = hex ?? swatch ?? word;
        if (color) actions.push({ type: "paint", room, color });
        continue;
      }
      if (/\b(floor(ing)?|tiles?)\b/.test(text) && room) {
        const id = Object.keys(FLOORING_INFO).find((k) => text.includes(k.replace(/-/g, " ")) || text.includes(FLOORING_INFO[k as keyof typeof FLOORING_INFO].label.toLowerCase()));
        if (id) {
          actions.push({ type: "set_flooring", room, flooring: id });
          continue;
        }
      }
      if (/\bwindow\b/.test(text) && room) {
        actions.push({ type: "add_window", room });
        continue;
      }
      if (/\bdoor\b/.test(text) && room) {
        actions.push({ type: "add_door", room, ...(rooms[1] ? { toRoom: rooms[1].name } : {}) });
        continue;
      }
      if (/\b(remove|delete)\b/.test(text) && room) {
        const item = itemIn(text);
        if (item || /\b(furniture|everything)\b/.test(text)) actions.push({ type: "remove_furniture", room, ...(item ? { item: item.id } : {}) });
        else actions.push({ type: "delete_room", room });
        continue;
      }
      if (/\b(add|put|place|give)\b/.test(text)) {
        const item = itemIn(text);
        if (item && room) {
          const n = text.match(/\b(\d+|two|three|four|five|six)\b/)?.[1];
          actions.push({ type: "add_furniture", room, item: item.id, ...(n ? { count: Number(n) || NUMBERS[n] } : {}) });
          continue;
        }
        // "add a bathroom next to the master bedroom": the new room is named first.
        const typeText = text.replace(/\b(next to|beside|near|by|adjacent to)\b.*$/, ""),
          type = roomTypeIn(typeText);
        if (type) {
          const nearText = text.match(/\b(?:next to|beside|near|by|adjacent to)\b(.*)$/)?.[1],
            near = nearText ? mentionedRooms(design, nearText)[0]?.name : undefined,
            floor = /first floor|upstairs/.test(text) ? 1 : /second floor/.test(text) ? 2 : undefined;
          actions.push({ type: "add_room", roomType: type, ...(near ? { near } : {}), ...(floor !== undefined ? { floor } : {}) });
          continue;
        }
      }
    }
    return {
      reply: actions.length
        ? `Here is what I will do (${actions.length} change${actions.length > 1 ? "s" : ""}).`
        : "I could not turn that into a change. Try “add a bathroom next to the master bedroom” or “furnish the living room”.",
      actions,
    };
  }
}
