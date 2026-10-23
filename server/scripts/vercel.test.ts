/**
 * The Vercel adapter, without Vercel or Atlas: URL restoring, the setup guards in the
 * function handler, cron authorisation, the disabled photo-to-3D routes, and one real
 * sign-up through the adapter. Run with `npm run test:vercel` from the project root.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { restoreApiUrl } from "../src/vercel/routing.js";
import { createVercelApp } from "../src/vercel/app.js";
import handler from "../src/vercel/handler.js";
import { parseEnvironment } from "../src/config/envSchema.js";
import { createRepositories } from "../src/repositories/index.js";

const ORIGIN = "https://habvion.example";
const CRON = "c".repeat(40);

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("rewritten API URLs are restored, and unsafe ones refused", () => {
  assert.equal(restoreApiUrl("/api/index?__hb_path=auth/me"), "/api/auth/me");
  assert.equal(restoreApiUrl("/api/index?__hb_path=designs/abc&x=1"), "/api/designs/abc?x=1");
  assert.equal(restoreApiUrl("/api/health"), "/api/health");
  assert.throws(() => restoreApiUrl("/api/index?__hb_path=../secret"));
  assert.throws(() => restoreApiUrl("/api/index?__hb_path=a&__hb_path=b"));
});

test("the function answers a safe 503 while required settings are missing", async () => {
  const saved = { MONGODB_URI: process.env.MONGODB_URI, CORS_ORIGIN: process.env.CORS_ORIGIN, SESSION_SECRET: process.env.SESSION_SECRET, AI_PROVIDER: process.env.AI_PROVIDER };
  delete process.env.MONGODB_URI;
  process.env.CORS_ORIGIN = ORIGIN;
  const server = createServer((req, res) => void handler(req, res));
  const base = await listen(server);
  try {
    const res = await fetch(`${base}/api/index?__hb_path=health`);
    assert.equal(res.status, 503);
    const body = await res.text();
    assert.match(body, /deployment configuration/);
    assert.doesNotMatch(body, /mongodb/i);
    assert.equal(res.headers.get("cache-control"), "no-store");
    // A database that cannot be reached is still a safe 503, never a crash or a leaked address.
    process.env.MONGODB_URI = "mongodb://127.0.0.1:9/never-contacted";
    process.env.SESSION_SECRET = randomBytes(48).toString("base64");
    process.env.AI_PROVIDER = "mock";
    const guarded = await fetch(`${base}/api/health`);
    assert.equal(guarded.status, 503);
  } finally {
    server.close();
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
});

test("the adapter: cron needs its secret, photo-to-3D is off, accounts work", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hb-vercel-"));
  // Not "production": that would hit the business-details guard, tested above.
  const config = parseEnvironment({
    NODE_ENV: "development",
    SESSION_SECRET: randomBytes(48).toString("base64"),
    AI_PROVIDER: "mock",
    MESH_PROVIDER: "mock",
    CORS_ORIGIN: ORIGIN,
    USERS_FILE: join(dir, "users.json"),
    DESIGNS_FILE: join(dir, "designs.json"),
    MESSAGES_FILE: join(dir, "messages.json"),
    ASSETS_DIR: join(dir, "assets"),
  });
  const repos = await createRepositories(config);
  const server = createServer(createVercelApp(config, repos, CRON));
  const base = await listen(server);
  try {
    assert.equal((await fetch(`${base}/api/retention`)).status, 401);
    assert.equal((await fetch(`${base}/api/retention`, { headers: { authorization: "Bearer wrong" } })).status, 401);
    const ok = await fetch(`${base}/api/retention`, { headers: { authorization: `Bearer ${CRON}` } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).ok, true);
    assert.equal((await fetch(`${base}/api/retention`, { method: "POST", headers: { authorization: `Bearer ${CRON}`, origin: ORIGIN } })).status, 405);

    assert.equal((await fetch(`${base}/api/imports/mesh`, { method: "POST", headers: { origin: ORIGIN } })).status, 503);
    assert.equal((await fetch(`${base}/api/assets/abc.glb`)).status, 503);

    const refused = await fetch(`${base}/api/auth/signup`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    assert.equal(refused.status, 403, "posts from other sites are refused");
    const signup = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ name: "Asha", email: "asha@example.com", password: "long enough pw", consent: true }),
    });
    assert.equal(signup.status, 201);
    assert.match(signup.headers.get("set-cookie") ?? "", /HttpOnly/i);
    assert.equal((await (await fetch(`${base}/api/demos`)).json()).demos.length > 0, true);
  } finally {
    server.close();
    await repos.close();
  }
});
