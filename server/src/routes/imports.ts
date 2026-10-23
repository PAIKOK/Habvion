import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { currentUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { UnsafeUrlError, assertPublicUrl, fetchProductPreview, type PageFetcher } from "../imports/preview.js";
import { MeshError, type MeshProvider } from "../imports/mesh.js";
import { GeneratedAssets, ASSET_FILE } from "../privacy/generatedAssets.js";
import { SHARE_TOKEN, type DesignRepository } from "../repositories/designs.js";
export { ASSET_FILE } from "../privacy/generatedAssets.js";

const previewBody = z.object({ url: z.string().trim().min(1).max(2000) });
const meshBody = z.object({ imageUrl: z.string().trim().min(1).max(2000), rightsConfirmed: z.literal(true), externalConsent: z.literal(true).optional() });
type Job = { owner: string; taskId: string; status: "pending" | "ready" | "failed"; modelUrl?: string; error?: string };

/** Signed-in only: read a product page, and optionally turn its photo into a model. */
export function importsRouter(deps: { mesh: MeshProvider; assets: GeneratedAssets; fetcher?: PageFetcher }) {
  const router = Router(),
    jobs = new Map<string, Job>();
  router.post("/preview", rateLimit(20), async (req, res) => {
    const parsed = previewBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Paste a product link." });
    try {
      res.json(await fetchProductPreview(parsed.data.url, deps.fetcher));
    } catch (e) {
      if (e instanceof UnsafeUrlError) return void res.status(400).json({ error: e.message });
      throw e;
    }
  });
  router.post("/mesh", rateLimit(10), async (req, res) => {
    const parsed = meshBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "A product photo and confirmation that you may process it are required." });
    if (deps.mesh.name !== "mock" && parsed.data.externalConsent !== true)
      return void res.status(403).json({ error: "Consent is required before sending the photo address to the external 3D provider.", code: "external-consent-required" });
    try {
      assertPublicUrl(parsed.data.imageUrl);
      const taskId = await deps.mesh.submit(parsed.data.imageUrl),
        id = `mesh-${randomBytes(12).toString("base64url")}`;
      jobs.set(id, { owner: currentUser(res)!.id, taskId, status: "pending" });
      res.status(202).json({ job: { id, status: "pending" } });
    } catch (e) {
      if (e instanceof UnsafeUrlError) return void res.status(400).json({ error: e.message });
      if (e instanceof MeshError) return void res.status(e.status).json({ error: e.message });
      throw e;
    }
  });
  router.get("/mesh/:id", async (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.owner !== currentUser(res)!.id) return void res.status(404).json({ error: "That model job was not found." });
    if (job.status === "pending") {
      try {
        const r = await deps.mesh.poll(job.taskId);
        if (r.status === "ready") {
          const modelUrl = await deps.assets.create(job.owner, r.glb);
          Object.assign(job, { status: "ready", modelUrl });
        } else if (r.status === "failed") Object.assign(job, { status: "failed", error: r.error });
      } catch (e) {
        if (e instanceof MeshError) return void res.status(e.status).json({ error: e.message });
        throw e;
      }
    }
    res.json({ job: { id: req.params.id, status: job.status, ...(job.error ? { error: job.error } : {}) }, modelUrl: job.modelUrl ?? null });
  });
  return router;
}

/** Private by default. A valid share link grants access only to that owner's referenced models. */
export function assetsRouter(assets: GeneratedAssets, designs: DesignRepository) {
  const router = Router();
  router.get("/:file", async (req, res) => {
    const file = req.params.file;
    if (!ASSET_FILE.test(file)) return void res.status(404).json({ error: "Not found." });
    const meta = await assets.ownership(file);
    if (!meta) return void res.status(404).json({ error: "Not found." });
    const viewer = currentUser(res);
    let allowed = viewer?.id === meta.ownerId;
    const token = typeof req.query.share === "string" ? req.query.share : "";
    if (!allowed && SHARE_TOKEN.test(token)) {
      const shared = await designs.byShareToken(token);
      allowed = shared?.ownerId === meta.ownerId && !!shared.design.customItems?.some((item) => item.modelUrl === `/api/assets/${file}`);
    }
    if (!allowed) return void res.status(404).json({ error: "Not found." });
    res.set({ "Content-Type": "model/gltf-binary", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    res.sendFile(file, { root: assets.root, dotfiles: "deny", cacheControl: false, lastModified: false }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Not found." });
    });
  });
  return router;
}
