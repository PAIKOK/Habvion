import { randomUUID } from "node:crypto";
import type { PublicUser } from "@shared/types/user";
import { JsonFile } from "./jsonFile.js";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  googleId?: string;
  /** When the person agreed to the terms and confirmed they are 18+, and which version. */
  consentedAt?: string;
  policyVersion?: string;
  createdAt: string;
};
export const toPublicUser = (u: StoredUser): PublicUser => ({ id: u.id, email: u.email, name: u.name, hasPassword: !!u.passwordHash, google: !!u.googleId });

export interface UserRepository {
  byId(id: string): Promise<StoredUser | null>;
  byEmail(email: string): Promise<StoredUser | null>;
  byGoogleId(googleId: string): Promise<StoredUser | null>;
  /** Refuses (returns null) if the email is taken. */
  create(user: Omit<StoredUser, "id" | "createdAt">): Promise<StoredUser | null>;
  update(id: string, patch: Partial<Pick<StoredUser, "name" | "passwordHash" | "googleId">>): Promise<StoredUser | null>;
  /** Erase the account record. True if it existed. */
  remove(id: string): Promise<boolean>;
}

export class FileUserRepository implements UserRepository {
  #file: JsonFile<{ users: StoredUser[] }>;
  constructor(path: string) {
    this.#file = new JsonFile(path, () => ({ users: [] }));
  }
  async byId(id: string) {
    return (await this.#file.read()).users.find((u) => u.id === id) ?? null;
  }
  async byEmail(email: string) {
    return (await this.#file.read()).users.find((u) => u.email === email.toLowerCase()) ?? null;
  }
  async byGoogleId(googleId: string) {
    return (await this.#file.read()).users.find((u) => u.googleId === googleId) ?? null;
  }
  create(input: Omit<StoredUser, "id" | "createdAt">) {
    return this.#file.update((data) => {
      const email = input.email.toLowerCase();
      if (data.users.some((u) => u.email === email)) return null;
      const user: StoredUser = { ...input, email, id: randomUUID(), createdAt: new Date().toISOString() };
      data.users.push(user);
      return user;
    });
  }
  update(id: string, patch: Partial<Pick<StoredUser, "name" | "passwordHash" | "googleId">>) {
    return this.#file.update((data) => {
      const u = data.users.find((x) => x.id === id);
      if (!u) return null;
      Object.assign(u, patch);
      return u;
    });
  }
  remove(id: string) {
    return this.#file.update((data) => {
      const before = data.users.length;
      data.users = data.users.filter((u) => u.id !== id);
      return data.users.length < before;
    });
  }
}
