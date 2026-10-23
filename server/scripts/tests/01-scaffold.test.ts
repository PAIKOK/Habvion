import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { check } from "../check.js";
import { parseEnvironment } from "../../src/config/envSchema.js";
import { createApp } from "../../src/app.js";
const secret = randomBytes(48).toString("base64");
const mock = { SESSION_SECRET: secret, AI_PROVIDER: "mock", MESH_PROVIDER: "mock" };
const config = parseEnvironment(mock);
check("mock providers require no API keys", !config.GOOGLE_API_KEY && !config.TRIPO_API_KEY);
check("standard port defaults to 4000", config.PORT === 4000);
check(
  "optional blank values are unset",
  parseEnvironment({ ...mock, GOOGLE_CLIENT_ID: "", MONGODB_URI: " " }).MONGODB_URI === undefined,
);
check(
  "blank defaulted values use defaults",
  parseEnvironment({ ...mock, PORT: "", AUTH_COOKIE_NAME: "" }).PORT === 4000,
);
check("configuration is frozen", Object.isFrozen(config));
for (const [label, input, expected] of [
  ["missing session secret", { AI_PROVIDER: "mock" }, "SESSION_SECRET"],
  ["short session secret", { ...mock, SESSION_SECRET: "short" }, "SESSION_SECRET"],
  ["Gemini without a key", { ...mock, AI_PROVIDER: "gemini" }, "GOOGLE_API_KEY"],
  ["Tripo without a key", { ...mock, MESH_PROVIDER: "tripo" }, "TRIPO_API_KEY"],
  ["invalid port", { ...mock, PORT: "70000" }, "PORT"],
] as const) {
  try {
    parseEnvironment(input);
    check(label + " fails loudly", false);
  } catch (error) {
    check(label + " fails loudly", error instanceof Error && error.message.includes(expected));
  }
}
const app = createApp(config);
const server = app.listen(0, "127.0.0.1");
try {
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const body = (await response.json()) as { status: string; app: string };
  check("health endpoint responds", response.status === 200 && body.status === "ok");
  check(
    "health does not expose keys or configuration",
    body.app === "Habvion" && !JSON.stringify(body).includes(secret),
  );
  check(
    "unknown route is a readable 404",
    (await fetch(`http://127.0.0.1:${address.port}/api/missing`)).status === 404,
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
