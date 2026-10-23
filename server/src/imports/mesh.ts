import type { Environment } from "../config/envSchema.js";

/** Photo → 3D model, behind one small interface. Keys come from the parsed environment. */
export type MeshPoll = { status: "pending" } | { status: "ready"; glb: Buffer } | { status: "failed"; error: string };
export interface MeshProvider {
  readonly name: string;
  submit(imageUrl: string): Promise<string>;
  poll(taskId: string): Promise<MeshPoll>;
}
export class MeshError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_GLB_BYTES = 30 * 1024 * 1024;

/**
 * Tripo's image-to-model API over plain fetch. The key is held privately, sent only as a
 * bearer header, and never logged; upstream errors are reduced to readable messages.
 */
export class TripoProvider implements MeshProvider {
  readonly name = "tripo";
  readonly #apiKey: string;
  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.#apiKey = apiKey;
  }
  async #call(path: string, init: RequestInit = {}) {
    let res: Response;
    try {
      res = await this.fetchImpl(`https://api.tripo3d.ai/v2/openapi${path}`, {
        ...init,
        headers: { authorization: `Bearer ${this.#apiKey}`, "content-type": "application/json", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new MeshError(502, "The 3D service could not be reached.");
    }
    if (res.status === 401 || res.status === 403) throw new MeshError(502, "The 3D service refused this API key. Check TRIPO_API_KEY.");
    if (res.status === 429) throw new MeshError(429, "The 3D service is busy. Try again in a minute.");
    const data = (await res.json().catch(() => null)) as { code?: number; data?: Record<string, unknown> } | null;
    if (!res.ok || !data || data.code !== 0) throw new MeshError(502, "The 3D service could not take this request.");
    return data.data ?? {};
  }
  async submit(imageUrl: string) {
    const ext = /\.png(\?|$)/i.test(imageUrl) ? "png" : /\.webp(\?|$)/i.test(imageUrl) ? "webp" : "jpg";
    const d = await this.#call("/task", { method: "POST", body: JSON.stringify({ type: "image_to_model", model_version: this.model, file: { type: ext, url: imageUrl } }) });
    if (typeof d.task_id !== "string") throw new MeshError(502, "The 3D service did not return a job.");
    return d.task_id;
  }
  async poll(taskId: string): Promise<MeshPoll> {
    const d = await this.#call(`/task/${encodeURIComponent(taskId)}`);
    const status = String(d.status ?? "");
    if (["queued", "running"].includes(status)) return { status: "pending" };
    if (status !== "success") return { status: "failed", error: "The 3D service could not make a model from this photo." };
    const out = (d.output ?? {}) as Record<string, unknown>,
      url = [out.pbr_model, out.model, out.base_model].find((u): u is string => typeof u === "string" && u.startsWith("https://"));
    if (!url) return { status: "failed", error: "The 3D service returned no model." };
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!res?.ok) return { status: "failed", error: "The finished model could not be downloaded." };
    const glb = Buffer.from(await res.arrayBuffer());
    if (glb.length > MAX_GLB_BYTES || glb.toString("ascii", 0, 4) !== "glTF") return { status: "failed", error: "The finished model was not a usable .glb file." };
    return { status: "ready", glb };
  }
}

/** A stand-in that needs no key: ready on the second poll with a small, valid box model. */
export class MockMeshProvider implements MeshProvider {
  readonly name = "mock";
  #polls = new Map<string, number>();
  #seq = 0;
  async submit(_imageUrl: string) {
    const id = `mock-${Date.now().toString(36)}-${(this.#seq++).toString(36)}`;
    this.#polls.set(id, 0);
    return id;
  }
  async poll(taskId: string): Promise<MeshPoll> {
    const n = this.#polls.get(taskId);
    if (n === undefined) return { status: "failed", error: "Unknown job." };
    this.#polls.set(taskId, n + 1);
    return n < 1 ? { status: "pending" } : { status: "ready", glb: boxGlb() };
  }
}

/** A unit cube as a binary glTF: enough to prove the whole pipeline end to end. */
export function boxGlb(): Buffer {
  const p = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, -0.5, -0.5, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0.5, -0.5, 1, 0.5],
    idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  const pos = Buffer.from(new Float32Array(p).buffer),
    ind = Buffer.from(new Uint16Array(idx).buffer),
    bin = Buffer.concat([pos, ind, Buffer.alloc((4 - ((pos.length + ind.length) % 4)) % 4)]);
  const json = {
    asset: { version: "2.0", generator: "homebuilder-mock" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.72, 0.6, 0.47, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.length, target: 34962 },
      { buffer: 0, byteOffset: pos.length, byteLength: ind.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
      { bufferView: 1, componentType: 5123, count: idx.length, type: "SCALAR" },
    ],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12),
    jsonHead = Buffer.alloc(8),
    binHead = Buffer.alloc(8);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  jsonHead.writeUInt32LE(js.length, 0);
  jsonHead.write("JSON", 4, "ascii");
  binHead.writeUInt32LE(bin.length, 0);
  binHead.write("BIN\0", 4, "ascii");
  return Buffer.concat([header, jsonHead, js, binHead, bin]);
}

/** The only place a mesh provider is chosen. */
export function createMeshProvider(config: Environment): MeshProvider {
  if (config.MESH_PROVIDER === "tripo") return new TripoProvider(config.TRIPO_API_KEY!, config.TRIPO_MODEL);
  return new MockMeshProvider();
}
