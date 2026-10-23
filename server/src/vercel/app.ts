import express from "express";
import { timingSafeEqual } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { createApp } from "../app.js";
import type { Environment } from "../config/envSchema.js";
import type { Repositories } from "../repositories/index.js";
import { createContactNotifier, type ContactNotifier } from "../contact/notify.js";
import { pruneOldMessages } from "../contact/retention.js";
import { MeshError, type MeshProvider } from "../imports/mesh.js";
import { privacyHttp } from "../privacy/http.js";

const MODEL_UNAVAILABLE = "Photo-generated models are unavailable on this deployment until durable model storage and job persistence are configured. Built-in furniture and 2D/3D previews are still available.";

const disabledMesh: MeshProvider = {
  name: "disabled-vercel",
  async submit() { throw new MeshError(503, MODEL_UNAVAILABLE); },
  async poll() { throw new MeshError(503, MODEL_UNAVAILABLE); },
};

/** Deployment-specific routes and lifecycle; the local server remains unchanged. */
export function createVercelApp(config: Environment, repos: Repositories, cronSecret: string | undefined) {
  const deliver = createContactNotifier(config);
  const notify: ContactNotifier | null = deliver ? (message) => {
    const task = deliver(message);
    // The contact route responds before delivery finishes. Keep its work alive,
    // while allowing the existing route to log delivery failures without content.
    waitUntil(task.catch(() => {}));
    return task;
  } : null;

  const core = createApp(config, { users: repos.users, designs: repos.designs, messages: repos.messages, mesh: disabledMesh, notify });
  const app = express();
  app.disable("x-powered-by");
  app.use(privacyHttp(config.CORS_ORIGIN.split(",").map((origin) => origin.trim())));

  app.all("/api/retention", async (req, res) => {
    if (!cronSecret || cronSecret.length < 32)
      return void res.status(503).json({ error: "Retention cleanup requires a CRON_SECRET of at least 32 characters." });
    const supplied = Buffer.from(req.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${cronSecret}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return void res.status(401).json({ error: "Not authorised." });
    if (req.method !== "GET")
      return void res.set("Allow", "GET").status(405).json({ error: "Use GET for scheduled retention cleanup." });
    try {
      res.json({ ok: true, removed: await pruneOldMessages(repos.messages) });
    } catch {
      console.error("Scheduled retention cleanup failed; no enquiry contents were logged.");
      res.status(503).json({ error: "Retention cleanup could not finish. Please try again." });
    }
  });

  // Process-local jobs and local GLB files cannot be made durable with /tmp.
  // Block both creation and serving rather than lose files or ownership metadata.
  app.use("/api/imports/mesh", (_req, res) => { res.status(503).json({ error: MODEL_UNAVAILABLE }); });
  app.use("/api/assets", (_req, res) => { res.status(503).json({ error: MODEL_UNAVAILABLE }); });
  app.use(core);
  return app;
}
