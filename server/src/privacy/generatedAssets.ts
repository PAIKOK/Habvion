import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const ASSET_FILE = /^([A-Za-z0-9_-]{32})\.glb$/;
type Ownership = { ownerId: string; createdAt: string };

/** Ownership stays private on disk. A bare, guessed or old unowned URL is not authorisation. */
export class GeneratedAssets {
  readonly root: string;
  constructor(root: string) { this.root = resolve(root); }
  #revokedPath(ownerId: string) {
    return join(this.root, `.revoked-${createHash("sha256").update(ownerId).digest("hex")}`);
  }
  async #revoked(ownerId: string) {
    try { await readFile(this.#revokedPath(ownerId)); return true; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return false; throw e; }
  }
  async ownership(file: string): Promise<Ownership | null> {
    const match = ASSET_FILE.exec(file);
    if (!match) return null;
    try {
      const value = JSON.parse(await readFile(join(this.root, `${match[1]}.owner.json`), "utf8")) as Partial<Ownership>;
      if (typeof value.ownerId !== "string" || !value.ownerId || value.ownerId.length > 128 || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) return null;
      if (await this.#revoked(value.ownerId)) return null;
      return value as Ownership;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || e instanceof SyntaxError) return null;
      throw e;
    }
  }
  async create(ownerId: string, glb: Buffer) {
    if (glb.length > 30 * 1024 * 1024 || glb.toString("ascii", 0, 4) !== "glTF") throw new Error("Not a supported model file.");
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    if (await this.#revoked(ownerId)) throw new Error("This account is being deleted.");
    const token = randomBytes(24).toString("base64url"), file = `${token}.glb`;
    const metadata = { ownerId, createdAt: new Date().toISOString() } satisfies Ownership;
    await writeFile(join(this.root, `${token}.owner.json`), JSON.stringify(metadata), { mode: 0o600, flag: "wx" });
    try {
      await writeFile(join(this.root, file), glb, { mode: 0o600, flag: "wx" });
      // A deletion that started during generation must not resurrect an accessible file.
      if (await this.#revoked(ownerId)) throw new Error("This account is being deleted.");
    } catch (e) {
      await Promise.all([rm(join(this.root, file), { force: true }), rm(join(this.root, `${token}.owner.json`), { force: true })]);
      throw e;
    }
    return `/api/assets/${file}`;
  }
  async listForOwner(ownerId: string) {
    const names = await readdir(this.root).catch((e: NodeJS.ErrnoException) => { if (e.code === "ENOENT") return [] as string[]; throw e; });
    const result: { url: string; createdAt: string }[] = [];
    for (const name of names.filter((n) => /^[A-Za-z0-9_-]{32}\.owner\.json$/.test(n))) {
      const file = name.replace(".owner.json", ".glb"), meta = await this.ownership(file);
      if (meta?.ownerId === ownerId) result.push({ url: `/api/assets/${file}`, createdAt: meta.createdAt });
    }
    return result;
  }
  /** Revoke first, then erase only assets with proven ownership; never delete unowned legacy files. */
  async revokeAndRemoveOwner(ownerId: string) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.#revokedPath(ownerId), "revoked", { mode: 0o600 });
    const names = await readdir(this.root);
    let removed = 0;
    for (const name of names.filter((n) => /^[A-Za-z0-9_-]{32}\.owner\.json$/.test(n))) {
      let meta: Partial<Ownership>;
      try { meta = JSON.parse(await readFile(join(this.root, name), "utf8")); }
      catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT" || e instanceof SyntaxError) continue; throw e; }
      if (meta.ownerId !== ownerId) continue;
      await rm(join(this.root, name.replace(".owner.json", ".glb")), { force: true });
      await rm(join(this.root, name), { force: true });
      removed++;
    }
    return removed;
  }
}
