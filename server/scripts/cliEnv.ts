import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseEnvironment } from "../src/config/envSchema.js";

/**
 * Settings for command-line helpers, which only touch storage and the contact webhook.
 * They never sign anyone in or call the AI or 3D services, so those settings (normally
 * supplied by `npm run dev`) are filled with throwaway values instead of being required.
 */
export const env = parseEnvironment({
  ...process.env,
  SESSION_SECRET: process.env.SESSION_SECRET || randomBytes(48).toString("base64"),
  AI_PROVIDER: "mock",
  MESH_PROVIDER: "mock",
});
