import { Router } from "express";
import { z } from "zod";
import type { HomeDesign } from "@shared/types/home";
import { parsePlan } from "@shared/ai/schema";
import { applyAiActions } from "@shared/ai/translate";
import { validateDesign } from "@shared/design/validation";
import { AiError, type AiProvider } from "../ai/providers/index.js";
import { rateLimit } from "../middleware/rateLimit.js";

const body = z.object({
  message: z.string().trim().min(1).max(2000),
  design: z.custom<HomeDesign>((v) => !!v && typeof v === "object" && Array.isArray((v as HomeDesign).rooms) && typeof (v as HomeDesign).plot === "object"),
  externalConsent: z.literal(true).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(10)
    .default([]),
});


export function aiRouter(provider: AiProvider) {
  const router = Router();
  // A stuck UI should not burn the provider's quota.
  router.post("/plan", rateLimit(20), async (req, res) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Send a message and the current design." });
    try {
      if (!validateDesign(parsed.data.design).ok) return void res.status(400).json({ error: "The design sent is not valid." });
      if (provider.name !== "mock" && parsed.data.externalConsent !== true)
        return void res.status(403).json({ error: "Consent is required before sending your request, relevant layout details and recent messages to the external AI provider.", code: "external-consent-required" });
      const { plan, dropped } = parsePlan(await provider.plan(parsed.data));
      // Translate on the server with the shared rules: each step validated, refusals reported.
      const { design, outcomes } = applyAiActions(parsed.data.design, plan.actions);
      res.json({
        reply: plan.reply,
        actions: plan.actions,
        outcomes: outcomes.map((o) => ({ type: o.action.type, applied: o.applied, message: o.message })),
        design: outcomes.some((o) => o.applied) ? design : null,
        dropped,
        provider: provider.name,
      });
    } catch (error) {
      if (error instanceof AiError) return void res.status(error.status).json({ error: error.message });
      res.status(502).json({ error: "The assistant failed. Please try again." });
    }
  });
  return router;
}
