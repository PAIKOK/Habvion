import { Router } from "express";
import { DEMOS, buildDemo } from "@shared/design/demos";
import { demoFacts } from "@shared/design/demos/facts";

/**
 * Public demo houses. Each is built once per process through the same validated actions
 * a person would use, then served as plain JSON so the browser never has to build one.
 */
export function demosRouter() {
  const router = Router();
  const card = (id: string) => {
    const demo = DEMOS.find((d) => d.id === id)!,
      built = buildDemo(id)!;
    return { id, title: demo.title, tagline: demo.tagline, facts: demoFacts(built.design) };
  };
  router.get("/", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300").json({ demos: DEMOS.map((d) => card(d.id)) });
  });
  router.get("/:id", (req, res) => {
    if (!DEMOS.some((d) => d.id === req.params.id)) return res.status(404).json({ error: "There is no demo home with that name." });
    res.set("Cache-Control", "public, max-age=300").json({ ...card(req.params.id), design: buildDemo(req.params.id)!.design });
  });
  return router;
}
/** Build every demo ahead of the first visitor. */
export function warmDemos() {
  for (const d of DEMOS) buildDemo(d.id);
}
