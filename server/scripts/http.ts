import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createApp, type AppDeps } from "../src/app.js";
import { parseEnvironment } from "../src/config/envSchema.js";

/** A real server on a free port with private temp data files and no keys. */
export async function startApp(env: Record<string, string> = {}, deps: AppDeps = {}) {
  const dir = await mkdtemp(join(tmpdir(), "hb-test-"));
  const config = parseEnvironment({
    SESSION_SECRET: randomBytes(48).toString("base64"),
    AI_PROVIDER: "mock",
    MESH_PROVIDER: "mock",
    USERS_FILE: join(dir, "users.json"),
    DESIGNS_FILE: join(dir, "designs.json"),
    MESSAGES_FILE: join(dir, "messages.json"),
    ASSETS_DIR: join(dir, "assets"),
    ...env,
  });
  const server = createApp(config, deps).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return { base, dir, config, close: () => new Promise<void>((r) => server.close(() => r())), client: () => client(base) };
}
/** fetch with a cookie jar, like one browser. */
export function client(base: string) {
  let cookie = "";
  async function call(path: string, init: { method?: string; body?: unknown; raw?: string } = {}) {
    const res = await fetch(base + path, {
      method: init.method ?? (init.body === undefined && init.raw === undefined ? "GET" : "POST"),
      headers: { ...(cookie ? { cookie } : {}), ...(init.body !== undefined || init.raw !== undefined ? { "content-type": "application/json" } : {}) },
      body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const pair = c.split(";")[0]!;
      cookie = /=$/.test(pair) || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) ? "" : pair;
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text, setCookie: set };
  }
  return { call, get cookie() { return cookie; }, set cookie(v: string) { cookie = v; } };
}
