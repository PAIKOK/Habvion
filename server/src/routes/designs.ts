import { Router } from "express";
import { z } from "zod";
import type { HomeDesign } from "@shared/types/home";
import { validateDesign } from "@shared/design/validation";
import { newShareToken, SHARE_TOKEN, summarize, type DesignRepository } from "../repositories/designs.js";
import { currentUser } from "../middleware/auth.js";

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const body = z.object({
  design: z.custom<HomeDesign>((v) => !!v && typeof v === "object" && typeof (v as HomeDesign).id === "string" && Array.isArray((v as HomeDesign).rooms)),
});
/** Only designs that pass the shared validator are stored; the editor never holds anything else. */
function parseDesign(raw: unknown): { design: HomeDesign } | { error: string } {
  const p = body.safeParse(raw);
  if (!p.success) return { error: "Send a design." };
  if (!ID.test(p.data.design.id)) return { error: "That design id is not allowed." };
  let v;
  try {
    v = validateDesign(p.data.design);
  } catch {
    return { error: "That design could not be read." };
  }
  if (!v.ok) return { error: v.issues.find((i) => i.level === "error")?.message ?? "That design is not valid." };
  return { design: p.data.design };
}

export function designsRouter(designs: DesignRepository) {
  const router = Router(),
    owner = (res: Parameters<typeof currentUser>[0]) => currentUser(res)!.id;
  router.get("/", async (_req, res) => res.json({ designs: await designs.list(owner(res)) }));
  router.post("/", async (req, res) => {
    const p = parseDesign(req.body);
    if ("error" in p) return void res.status(400).json({ error: p.error });
    const made = await designs.create(owner(res), p.design);
    if (!made) return void res.status(409).json({ error: "A design with this id already exists." });
    res.status(201).json({ design: made.design, summary: summarize(made) });
  });
  router.get("/:id", async (req, res) => {
    const s = ID.test(req.params.id) ? await designs.get(owner(res), req.params.id) : null;
    if (!s) return void res.status(404).json({ error: "Design not found." });
    res.json({ design: s.design, summary: summarize(s), shareToken: s.shareToken ?? null });
  });
  router.put("/:id", async (req, res) => {
    const p = parseDesign(req.body);
    if ("error" in p) return void res.status(400).json({ error: p.error });
    if (p.design.id !== req.params.id) return void res.status(400).json({ error: "The design id does not match." });
    const s = await designs.save(owner(res), req.params.id, p.design);
    if (!s) return void res.status(404).json({ error: "Design not found." });
    res.json({ summary: summarize(s) });
  });
  router.delete("/:id", async (req, res) => {
    if (!ID.test(req.params.id) || !(await designs.remove(owner(res), req.params.id))) return void res.status(404).json({ error: "Design not found." });
    res.json({ ok: true });
  });
  router.post("/:id/share", async (req, res) => {
    const s = ID.test(req.params.id) ? await designs.get(owner(res), req.params.id) : null;
    if (!s) return void res.status(404).json({ error: "Design not found." });
    const token = s.shareToken ?? newShareToken();
    await designs.setShareToken(owner(res), s.id, token);
    res.json({ token });
  });
  router.delete("/:id/share", async (req, res) => {
    const s = ID.test(req.params.id) ? await designs.setShareToken(owner(res), req.params.id, null) : null;
    if (!s) return void res.status(404).json({ error: "Design not found." });
    res.json({ ok: true });
  });
  return router;
}
/** Public, read-only: a share link shows the design and nothing about its owner. */
export function sharedRouter(designs: DesignRepository) {
  const router = Router();
  router.get("/:token", async (req, res) => {
    const s = SHARE_TOKEN.test(req.params.token) ? await designs.byShareToken(req.params.token) : null;
    if (!s) return void res.status(404).json({ error: "This share link is not valid or was turned off." });
    res.set("Cache-Control", "no-store").json({ design: s.design });
  });
  return router;
}
