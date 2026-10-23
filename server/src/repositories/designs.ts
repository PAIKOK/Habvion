import { randomBytes } from "node:crypto";
import type { HomeDesign } from "@shared/types/home";
import { JsonFile } from "./jsonFile.js";

export type StoredDesign = {
  id: string;
  ownerId: string;
  design: HomeDesign;
  createdAt: string;
  updatedAt: string;
  shareToken?: string;
};
export type DesignSummary = {
  id: string;
  name: string;
  updatedAt: string;
  plot: { width: number; length: number; roadSide: string };
  floors: number;
  rooms: number;
  shared: boolean;
  /** Ground-floor room rectangles [x, y, width, length, open-air?] for a thumbnail. */
  outline: [number, number, number, number, 0 | 1][];
};
const OPEN = ["balcony", "terrace", "courtyard", "garden", "parking", "porch"];
export const summarize = (s: StoredDesign): DesignSummary => ({
  id: s.id,
  name: s.design.name,
  updatedAt: s.updatedAt,
  plot: { width: s.design.plot.width, length: s.design.plot.length, roadSide: s.design.plot.roadSide },
  floors: s.design.floors.length,
  rooms: s.design.rooms.length,
  shared: !!s.shareToken,
  outline: s.design.rooms.filter((r) => r.floor === 0).map((r) => [r.x, r.y, r.width, r.length, OPEN.includes(r.type) ? 1 : 0]),
});
/** 24 random bytes, base64url: 32 unguessable characters. */
export const newShareToken = () => randomBytes(24).toString("base64url");
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{32}$/;

/** Every call is scoped to its owner; another user's id behaves exactly like a missing one. */
export interface DesignRepository {
  list(ownerId: string): Promise<DesignSummary[]>;
  get(ownerId: string, id: string): Promise<StoredDesign | null>;
  /** Stores under the design's own id; refuses (null) if that id already exists. */
  create(ownerId: string, design: HomeDesign): Promise<StoredDesign | null>;
  /** Last write wins. */
  save(ownerId: string, id: string, design: HomeDesign): Promise<StoredDesign | null>;
  remove(ownerId: string, id: string): Promise<boolean>;
  setShareToken(ownerId: string, id: string, token: string | null): Promise<StoredDesign | null>;
  byShareToken(token: string): Promise<StoredDesign | null>;
}

export class FileDesignRepository implements DesignRepository {
  #file: JsonFile<{ designs: StoredDesign[] }>;
  constructor(path: string) {
    this.#file = new JsonFile(path, () => ({ designs: [] }));
  }
  async list(ownerId: string) {
    return (await this.#file.read()).designs
      .filter((d) => d.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summarize);
  }
  async get(ownerId: string, id: string) {
    return (await this.#file.read()).designs.find((d) => d.id === id && d.ownerId === ownerId) ?? null;
  }
  create(ownerId: string, design: HomeDesign) {
    return this.#file.update((data) => {
      if (data.designs.some((d) => d.id === design.id)) return null;
      const now = new Date().toISOString(),
        s: StoredDesign = { id: design.id, ownerId, design, createdAt: now, updatedAt: now };
      data.designs.push(s);
      return s;
    });
  }
  save(ownerId: string, id: string, design: HomeDesign) {
    return this.#file.update((data) => {
      const s = data.designs.find((d) => d.id === id && d.ownerId === ownerId);
      if (!s) return null;
      s.design = { ...design, id };
      s.updatedAt = new Date().toISOString();
      return s;
    });
  }
  remove(ownerId: string, id: string) {
    return this.#file.update((data) => {
      const i = data.designs.findIndex((d) => d.id === id && d.ownerId === ownerId);
      if (i >= 0) data.designs.splice(i, 1);
      return i >= 0;
    });
  }
  setShareToken(ownerId: string, id: string, token: string | null) {
    return this.#file.update((data) => {
      const s = data.designs.find((d) => d.id === id && d.ownerId === ownerId);
      if (!s) return null;
      if (token) s.shareToken = token;
      else delete s.shareToken;
      return s;
    });
  }
  async byShareToken(token: string) {
    return (await this.#file.read()).designs.find((d) => d.shareToken === token) ?? null;
  }
}
