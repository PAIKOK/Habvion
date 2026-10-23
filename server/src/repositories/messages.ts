import { randomBytes } from "node:crypto";
import type { ContactTopic, Utm } from "@shared/contact/schema";
import { JsonFile } from "./jsonFile.js";

export type StoredMessage = {
  id: string;
  name: string;
  email: string;
  /** Legacy records only. New forms ignore and do not collect phone numbers. */
  phone?: string;
  consentedAt?: string;
  policyVersion?: string;
  purpose?: "enquiry-response";
  externalDeliveryPermitted?: boolean;
  /** Only newly consented enquiries get this expiry; legacy records require operator review. */
  expiresAt?: string;
  topic: ContactTopic;
  message: string;
  /** Campaign tags from the link the visitor arrived by, if any. Never forwarded to Google Sheets. */
  utm?: Utm;
  attributionConsentedAt?: string;
  /** Set when the sender was signed in, so a reply can find their designs. */
  userId?: string;
  createdAt: string;
};
export type NewMessage = Omit<StoredMessage, "id" | "createdAt">;

/** A short reference people can quote back, e.g. "HB-7K2Q9M". No 0/O or 1/I to misread. */
export function newReference() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ",
    bytes = randomBytes(6);
  return "HB-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export interface MessageRepository {
  create(message: NewMessage): Promise<StoredMessage>;
  /** Newest first. */
  list(limit?: number): Promise<StoredMessage[]>;
  /** Everything one account sent, for export. */
  forUser(userId: string): Promise<StoredMessage[]>;
  /** Erase what one account sent. Returns how many. */
  removeForUser(userId: string): Promise<number>;
  /** Erase messages received before `cutoff` (ISO time). Returns how many. */
  removeOlderThan(cutoff: string): Promise<number>;
  removeExpired(now: string): Promise<number>;
}

export class FileMessageRepository implements MessageRepository {
  #file: JsonFile<{ messages: StoredMessage[] }>;
  constructor(path: string) {
    this.#file = new JsonFile(path, () => ({ messages: [] }));
  }
  create(input: NewMessage) {
    return this.#file.update((data) => {
      const message: StoredMessage = { id: newReference(), ...input, createdAt: new Date().toISOString() };
      data.messages.push(message);
      return message;
    });
  }
  async list(limit = 50) {
    return [...(await this.#file.read()).messages].reverse().slice(0, limit);
  }
  async forUser(userId: string) {
    return (await this.#file.read()).messages.filter((m) => m.userId === userId);
  }
  #removeWhere(drop: (m: StoredMessage) => boolean) {
    return this.#file.update((data) => {
      const before = data.messages.length;
      data.messages = data.messages.filter((m) => !drop(m));
      return before - data.messages.length;
    });
  }
  removeForUser(userId: string) {
    return this.#removeWhere((m) => m.userId === userId);
  }
  removeOlderThan(cutoff: string) {
    return this.#removeWhere((m) => m.createdAt < cutoff);
  }
  removeExpired(now: string) {
    return this.#removeWhere((m) => typeof m.expiresAt === "string" && Number.isFinite(Date.parse(m.expiresAt)) && m.expiresAt <= now);
  }
}
