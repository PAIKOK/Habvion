import { z } from "zod";
import { FLOORING_IDS, ROOM_TYPES } from "../types/home";

const side = z.enum(["north", "east", "south", "west"]);
const roomRef = z.string().trim().min(1).max(80);
const size = z.number().finite().min(3).max(60);
/**
 * The only things the assistant may ask for. Every action names rooms by name or id
 * and catalog items by id; the translator resolves them and the reducer validates.
 */
export const aiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_room"), roomType: z.enum(ROOM_TYPES), name: z.string().max(60).optional(), width: size.optional(), length: size.optional(), floor: z.number().int().min(0).max(9).optional(), near: roomRef.optional() }),
  z.object({ type: z.literal("resize_room"), room: roomRef, width: size.optional(), length: size.optional() }),
  z.object({ type: z.literal("rename_room"), room: roomRef, name: z.string().trim().min(1).max(60) }),
  z.object({ type: z.literal("delete_room"), room: roomRef }),
  z.object({ type: z.literal("add_furniture"), room: roomRef, item: z.string().min(1).max(60), count: z.number().int().min(1).max(12).optional() }),
  z.object({ type: z.literal("furnish_room"), room: roomRef }),
  z.object({ type: z.literal("remove_furniture"), room: roomRef, item: z.string().max(60).optional() }),
  z.object({ type: z.literal("add_door"), room: roomRef, toRoom: roomRef.optional(), side: side.optional() }),
  z.object({ type: z.literal("add_window"), room: roomRef, side: side.optional() }),
  z.object({ type: z.literal("paint"), room: roomRef, color: z.string().min(1).max(30), side: side.optional() }),
  z.object({ type: z.literal("set_flooring"), room: roomRef, flooring: z.enum(FLOORING_IDS) }),
  z.object({ type: z.literal("set_floors"), count: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal("set_roof"), roofType: z.enum(["none", "flat", "shed", "gable", "hip", "pyramid"]), material: z.string().max(30).optional() }),
  z.object({ type: z.literal("set_compound"), enabled: z.boolean() }),
  z.object({ type: z.literal("set_systems"), smartHome: z.boolean().optional(), security: z.boolean().optional() }),
]);
export type AiAction = z.infer<typeof aiActionSchema>;
export const aiPlanSchema = z.object({
  reply: z.string().max(2000),
  actions: z.array(aiActionSchema).max(40),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;
/** Parse a provider's output leniently: keep the valid actions, report the rest. */
export function parsePlan(raw: unknown): { plan: AiPlan; dropped: number } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as { reply?: unknown; actions?: unknown };
  const actions = Array.isArray(obj.actions) ? obj.actions : [];
  const valid = actions.map((a) => aiActionSchema.safeParse(a)).filter((r) => r.success).map((r) => r.data!);
  return {
    plan: { reply: typeof obj.reply === "string" ? obj.reply.slice(0, 2000) : "", actions: valid.slice(0, 40) },
    dropped: actions.length - valid.length,
  };
}
