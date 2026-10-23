import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import type { Environment } from "./config/envSchema.js";
import { createAiProvider, type AiProvider } from "./ai/providers/index.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { createSessions } from "./auth/session.js";
import { createGoogleVerifier, type GoogleVerifier } from "./auth/google.js";
import { FileUserRepository, type UserRepository } from "./repositories/users.js";
import { FileDesignRepository, type DesignRepository } from "./repositories/designs.js";
import { FileMessageRepository, type MessageRepository } from "./repositories/messages.js";
import { contactRouter } from "./routes/contact.js";
import { createContactNotifier, type ContactNotifier } from "./contact/notify.js";
import { designsRouter, sharedRouter } from "./routes/designs.js";
import { demosRouter } from "./routes/demos.js";
import { assetsRouter, importsRouter } from "./routes/imports.js";
import { createMeshProvider, type MeshProvider } from "./imports/mesh.js";
import type { PageFetcher } from "./imports/preview.js";
import { loadUser, requireAuth } from "./middleware/auth.js";
import { APP_NAME } from "@shared/version";
import { assertBusinessConfigured } from "@shared/legal/business";
import { GeneratedAssets } from "./privacy/generatedAssets.js";
import { privacyHttp } from "./privacy/http.js";

export type AppDeps = { ai?: AiProvider; users?: UserRepository; designs?: DesignRepository; messages?: MessageRepository; notify?: ContactNotifier | null; google?: GoogleVerifier | null; mesh?: MeshProvider; fetcher?: PageFetcher };

export function createApp(config: Environment, deps: AppDeps = {}) {
  if (config.NODE_ENV === "production") assertBusinessConfigured();
  const app = express(),
    users = deps.users ?? new FileUserRepository(config.USERS_FILE),
    designs = deps.designs ?? new FileDesignRepository(config.DESIGNS_FILE),
    messages = deps.messages ?? new FileMessageRepository(config.MESSAGES_FILE),
    sessions = createSessions(config.SESSION_SECRET, config.AUTH_COOKIE_NAME, config.NODE_ENV === "production"),
    google = deps.google !== undefined ? deps.google : config.GOOGLE_CLIENT_ID ? createGoogleVerifier(config.GOOGLE_CLIENT_ID) : null,
    ai = deps.ai ?? createAiProvider(config),
    mesh = deps.mesh ?? createMeshProvider(config),
    notify = deps.notify === null ? undefined : (deps.notify ?? createContactNotifier(config)),
    assets = new GeneratedAssets(config.ASSETS_DIR),
    origins = config.CORS_ORIGIN.split(",").map((o) => o.trim());
  app.disable("x-powered-by");
  app.disable("etag");
  app.use(privacyHttp(origins));
  app.set("trust proxy", "loopback");
  app.use(cors({ origin: config.CORS_ORIGIN.split(",").map((x) => x.trim()), credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(loadUser(sessions, users));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", app: APP_NAME, uptime: process.uptime() }));
  app.use("/api/auth", authRouter({ users, sessions, google, googleClientId: config.GOOGLE_CLIENT_ID, designs, messages, assets,
    siteConfig: { googleClientId: config.GOOGLE_CLIENT_ID ?? null, aiProvider: ai.name, meshProvider: mesh.name, contactForwardingEnabled: !!notify, authCookieName: sessions.cookieName },
  }));
  app.use("/api/designs", requireAuth, designsRouter(designs));
  app.use("/api/shared", sharedRouter(designs));
  app.use("/api/demos", demosRouter());
  app.use("/api/contact", contactRouter(messages, notify));
  app.use("/api/imports", requireAuth, importsRouter({ mesh, assets, fetcher: deps.fetcher }));
  app.use("/api/assets", assetsRouter(assets, designs));
  app.use("/api/ai", requireAuth, aiRouter(ai));
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof SyntaxError ? 400 : (error as { status?: number }).status === 413 ? 413 : 500;
    res.status(status).json({ error: status === 400 ? "Invalid JSON request" : status === 413 ? "That request is too large." : "Something went wrong. Please try again." });
  });
  return app;
}
