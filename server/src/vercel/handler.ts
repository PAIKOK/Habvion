import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Express } from "express";
import { assertBusinessConfigured } from "@shared/legal/business";
import { parseEnvironment } from "../config/envSchema.js";
import { createRepositories } from "../repositories/index.js";
import { createVercelApp } from "./app.js";
import { restoreApiUrl } from "./routing.js";

class DeploymentSetupError extends Error {}
let appPromise: Promise<Express> | undefined;

async function initialize(): Promise<Express> {
  if (!process.env.MONGODB_URI?.trim())
    throw new DeploymentSetupError("Set MONGODB_URI in Vercel. File-backed accounts, designs and enquiries are not supported in serverless deployments.");
  if (!process.env.CORS_ORIGIN?.trim())
    throw new DeploymentSetupError("Set CORS_ORIGIN to the exact HTTPS origins allowed to use this deployment.");

  let config;
  try {
    config = parseEnvironment({
      ...process.env,
      NODE_ENV: "production",
      MESH_PROVIDER: "mock", // Never initialise an external mesh provider here.
      // Only the empty-assets export/deletion routines may touch this temporary
      // directory. Model creation/serving is disabled; it is NOT durable storage.
      ASSETS_DIR: join(tmpdir(), "habvion-disabled-generated-assets"),
    });
    // Check BEFORE connecting. Missing business details must not be bypassed by
    // setting NODE_ENV=test or development in the hosting dashboard.
    assertBusinessConfigured();
  } catch (error) {
    // These two validators only report field names/instructions, not env values.
    throw new DeploymentSetupError(error instanceof Error ? error.message : "Invalid deployment configuration.");
  }

  const repos = await createRepositories(config).catch(() => {
    // Driver errors can include connection details. Never echo them to logs/UI.
    throw new DeploymentSetupError("MongoDB connection or index setup failed. Check the rotated credentials, database permissions and Atlas network access privately.");
  });
  try {
    return createVercelApp(config, repos, process.env.CRON_SECRET);
  } catch (error) {
    await repos.close().catch(() => {});
    throw error;
  }
}

function getApp(): Promise<Express> {
  // Share the connection/application, including concurrent cold-start requests.
  // Reset a failed attempt so a transient database failure is not cached forever.
  return appPromise ??= initialize().catch((error: unknown) => {
    appPromise = undefined;
    console.error(error instanceof DeploymentSetupError ? error.message : "Vercel API initialization failed. Check the deployment configuration privately.");
    throw error;
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    req.url = restoreApiUrl(req.url);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Invalid API request path." }));
    return;
  }
  try {
    const app = await getApp();
    await new Promise<void>((resolve) => {
      const done = () => { res.off("finish", done); res.off("close", done); resolve(); };
      res.once("finish", done);
      res.once("close", done);
      app(req, res);
    });
  } catch {
    if (res.headersSent) { res.end(); return; }
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "The API is unavailable. The site operator must check the deployment configuration." }));
  }
}
