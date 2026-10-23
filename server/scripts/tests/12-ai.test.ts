import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { check } from "../check.js";
import { sampleHouse } from "../fixtures.js";
import { parsePlan } from "@shared/ai/schema";
import { applyAiActions, findRoom, resolveColor } from "@shared/ai/translate";
import { SYSTEM_PROMPT, describeDesign } from "@shared/ai/context";
import { validateDesign } from "@shared/design/validation";
import { wallColor } from "@shared/design/finishes";
import { MockProvider } from "../../src/ai/providers/mock.js";
import { GeminiProvider } from "../../src/ai/providers/gemini.js";
import { AiError } from "../../src/ai/providers/provider.js";
import { startApp } from "../http.js";

const { design: d } = sampleHouse();

// --- schema: lenient parse keeps valid actions only
{
  const { plan, dropped } = parsePlan({
    reply: "ok",
    actions: [{ type: "furnish_room", room: "Kitchen" }, { type: "explode" }, { type: "add_room", roomType: "castle" }, "junk"],
  });
  check("parsePlan keeps the valid action", plan.actions.length === 1 && plan.actions[0]!.type === "furnish_room");
  check("parsePlan counts what it dropped", dropped === 3);
  check("parsePlan survives garbage", parsePlan("nonsense").plan.actions.length === 0 && parsePlan(null).plan.reply === "");
}
// --- resolution helpers
check("findRoom by exact name", findRoom(d, "kitchen")?.id === "kit");
check("findRoom prefers the longer name", findRoom(d, "master bedroom")?.id === "mb");
check("findRoom by type phrase", findRoom(d, "living room")?.id === "liv");
check("colour by swatch, word and hex", resolveColor("Sage") === "#b7c4a4" && !!resolveColor("blue") && resolveColor("#AABBCC") === "#aabbcc");
check("unknown colour is refused", resolveColor("plaid") === undefined);
check("prompt uses the Habvion identity", SYSTEM_PROMPT.startsWith("You are the Habvion design assistant for Indian homes."));
check("prompt carries the catalog and contract", SYSTEM_PROMPT.includes("sofa-3") && SYSTEM_PROMPT.includes('"actions"'));
check("design description lists rooms", describeDesign(d).includes("Master bedroom (master-bedroom) floor 1"));

// --- translation: every applied step validates; refusals are reported, not thrown
{
  const { design: out, outcomes } = applyAiActions(d, [
    { type: "add_room", roomType: "attached-bathroom", near: "Master bedroom" },
    { type: "paint", room: "Kitchen", color: "sage" },
    { type: "set_flooring", room: "Living", flooring: "wood" },
    { type: "furnish_room", room: "Kitchen" },
    { type: "add_furniture", room: "Garden", item: "planter", count: 2 },
    { type: "add_window", room: "Bedroom" },
    { type: "set_roof", roofType: "gable" },
    { type: "set_compound", enabled: true },
    { type: "delete_room", room: "Ballroom" },
    { type: "add_furniture", room: "Kitchen", item: "spaceship" },
    { type: "resize_room", room: "Kitchen", width: 40 },
  ]);
  const by = (i: number) => outcomes[i]!;
  check("translated design is valid", validateDesign(out).ok, validateDesign(out).issues.filter((i) => i.level === "error").map((i) => i.message).join("; "));
  const bath = out.rooms.find((r) => r.type === "attached-bathroom");
  check("bathroom added beside the master bedroom on its floor", by(0).applied && bath?.floor === 1, by(0).message);
  check(
    "a door joins the new bathroom to the bedroom",
    !!bath && out.doors.some((o) => o.roomId === bath.id) && by(0).message.includes("door"),
  );
  check("kitchen painted sage", by(1).applied && wallColor(out, "kit", "east") === "#b7c4a4");
  check("living floored in wood", by(2).applied && out.flooring["liv"] === "wood");
  check("kitchen furnished with more than one piece", by(3).applied && out.furniture.filter((f) => f.roomId === "kit").length > 2, by(3).message);
  check("two planters in the garden", by(4).applied && out.furniture.filter((f) => f.roomId === "gar" && f.catalogId === "planter").length === 2);
  check("window added on an outside wall", by(5).applied && out.windows.length === d.windows.length + 1, by(5).message);
  check("gable roof set", by(6).applied && out.roof?.type === "gable");
  check("compound added", by(7).applied && !!out.compound);
  check("unknown room refused with a reason", !by(8).applied && by(8).message.includes("Ballroom"));
  check("unknown item refused", !by(9).applied && by(9).message.includes("catalog"));
  check("oversize resize refused by the reducer", !by(10).applied && out.rooms.find((r) => r.id === "kit")!.width === 10);
  check("input design untouched", d.rooms.length === 8 && !d.compound);
}

// --- furnishing an already furnished room fills gaps only
{
  const { design: out, outcomes } = applyAiActions(d, [{ type: "furnish_room", room: "Bedroom" }]),
    beds = out.furniture.filter((f) => f.roomId === "bed" && f.catalogId.startsWith("bed-"));
  check("furnish keeps the one existing bed", beds.length === 1, outcomes[0]!.message);
  check("furnish adds nightstands beside the existing bed", out.furniture.filter((f) => f.roomId === "bed" && f.catalogId === "nightstand").length >= 1);
  const again = applyAiActions(out, [{ type: "furnish_room", room: "Bedroom" }]);
  check("furnishing twice adds nothing new", again.design.furniture.length === out.furniture.length, again.outcomes[0]!.message);
}
// --- mock provider: deterministic keyword planning
{
  const mock = new MockProvider(),
    plan = async (message: string) => parsePlan(await mock.plan({ message, design: d, history: [] })).plan;
  const a = await plan("Add a bathroom next to the master bedroom");
  check("mock: add room near", a.actions[0]?.type === "add_room" && (a.actions[0] as { near?: string }).near === "Master bedroom", JSON.stringify(a.actions));
  const b = await plan("furnish the kitchen and paint the living room blue");
  check("mock: two clauses", b.actions.map((x) => x.type).join() === "furnish_room,paint", JSON.stringify(b.actions));
  const c = await plan("give it a hip roof, add a compound wall");
  check("mock: roof and compound", c.actions.map((x) => x.type).join() === "set_roof,set_compound", JSON.stringify(c.actions));
  const e = await plan("put 2 planters in the garden");
  check("mock: furniture with count", e.actions[0]?.type === "add_furniture" && (e.actions[0] as { count?: number }).count === 2, JSON.stringify(e.actions));
  const f = await plan("tell me a joke");
  check("mock: nothing to do explains itself", f.actions.length === 0 && f.reply.length > 10);
}

// --- Gemini provider: key only in a header, errors sanitised
{
  const fakeKey = "test-key-" + randomBytes(8).toString("hex");
  let seen: { url: string; headers: Record<string, string>; body: string } | null = null;
  const respond = (status: number, body: unknown) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init!.headers as Record<string, string>, body: String(init!.body) };
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
  const ok = new GeminiProvider(fakeKey, "gemini-2.5-flash", respond(200, { candidates: [{ content: { parts: [{ text: '{"reply":"hi","actions":[]}' }] } }] }));
  const out = (await ok.plan({ message: "hello", design: d, history: [] })) as { reply: string };
  check("gemini: parses JSON mode output", out.reply === "hi");
  const s = seen as unknown as { url: string; headers: Record<string, string>; body: string };
  check("gemini: key sent as header", s.headers["x-goog-api-key"] === fakeKey);
  check("gemini: key never in URL or body", !s.url.includes(fakeKey) && !s.body.includes(fakeKey));
  for (const [status, expect] of [
    [403, 502],
    [429, 429],
    [500, 502],
  ] as const) {
    const p = new GeminiProvider(fakeKey, "m", respond(status, { error: { message: `bad key ${fakeKey}` } }));
    try {
      await p.plan({ message: "x", design: d, history: [] });
      check(`gemini ${status}: throws`, false);
    } catch (err) {
      check(
        `gemini ${status}: sanitised error`,
        err instanceof AiError && err.status === expect && !err.message.includes(fakeKey) && !err.message.includes("bad key"),
        err instanceof Error ? err.message : "",
      );
    }
  }
  const json = JSON.stringify(ok);
  check("gemini: key not enumerable on the provider", !json.includes(fakeKey));
}

// --- route (signed in)
{
  const app = await startApp();
  const anon = app.client();
  check("route: refuses anonymous callers", (await anon.call("/ai/plan", { body: { message: "furnish the kitchen", design: d } })).status === 401);
  const c = app.client();
  await c.call("/auth/signup", { body: { consent: true, name: "Asha", email: "asha@example.com", password: "long enough pw" } });
  const post = (body: unknown) => c.call("/ai/plan", { body });
  const r = await post({ message: "furnish the kitchen", design: d });
  const j = r.json as { actions: unknown[]; provider: string; outcomes: { applied: boolean }[]; design: { furniture: unknown[] } | null };
  check("route: returns a validated plan", r.status === 200 && j.provider === "mock" && j.actions.length === 1);
  check("route: translates and applies on the server", j.outcomes[0]?.applied === true && !!j.design && j.design.furniture.length > d.furniture.length);
  check("route: rejects an invalid design", (await post({ message: "furnish the kitchen", design: { ...d, rooms: [...d.rooms, { ...d.rooms[0]!, id: "dup" }] } })).status === 400);
  check("route: rejects a missing design", (await post({ message: "hi" })).status === 400);
  check("route: rejects an empty message", (await post({ message: "  ", design: d })).status === 400);
  await app.close();
  const throwing = await startApp({}, { ai: { name: "boom", plan: async () => { throw new Error("secret upstream detail"); } } });
  const t = throwing.client();
  await t.call("/auth/signup", { body: { consent: true, name: "Asha", email: "asha@example.com", password: "long enough pw" } });
  const r2 = await t.call("/ai/plan", { body: { message: "x", design: d } });
  check("route: unknown failures are generic", r2.status === 502 && !r2.text.includes("secret upstream"));
  await throwing.close();
}

// --- no key material in source
{
  const roots = ["../../src", "../../../shared/src", "../../../client/src"].map((p) => new URL(p, import.meta.url).pathname);
  const offenders: string[] = [];
  async function scan(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await scan(p);
      else if (/\.(ts|tsx)$/.test(e.name) && /AIza[0-9A-Za-z_-]{20,}|GOCSPX-|mongodb\+srv:\/\/[^@\s]+:[^@\s]+@/.test(await readFile(p, "utf8"))) offenders.push(p);
    }
  }
  for (const r of roots) await scan(r);
  check("no API keys or credentials hardcoded in source", offenders.length === 0, offenders.join(", "));
  const clientCode = await readdir(roots[2]!, { recursive: true });
  let leaks = 0;
  for (const f of clientCode.filter((f) => /\.(ts|tsx)$/.test(f))) if (/GOOGLE_API_KEY|TRIPO_API_KEY|process\.env/.test(await readFile(join(roots[2]!, f), "utf8"))) leaks++;
  check("client never references server secrets", leaks === 0);
}
