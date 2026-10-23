import type { MessageRepository } from "../repositories/messages.js";

/** Default for NEW support enquiries; old records are not silently assigned a new retention term. */
export const MESSAGE_RETENTION_DAYS = 90;
export async function pruneOldMessages(messages: MessageRepository, now = Date.now()) {
  const removed = await messages.removeExpired(new Date(now).toISOString());
  if (removed) console.log(`Deleted ${removed} expired contact enquiry record(s).`);
  return removed;
}
