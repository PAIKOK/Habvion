import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { check } from "../check.js";
import { sampleHouse } from "../fixtures.js";
import { startApp } from "../http.js";
import { createDesign } from "@shared/design/createDesign";
import { FileUserRepository, type UserRepository } from "../../src/repositories/users.js";
import { FileDesignRepository, type DesignRepository } from "../../src/repositories/designs.js";
import { connectMongo } from "../../src/repositories/mongo.js";

const { design: house } = sampleHouse();

/** The same contract, run against every storage backend. */
async function contract(kind: string, users: UserRepository, designs: DesignRepository) {
  const t = (label: string, ok: boolean, detail = "") => check(`${kind}: ${label}`, ok, detail);
  const a = (await users.create({ email: "A@Example.com", name: "A", passwordHash: "scrypt$x" }))!;
  const b = (await users.create({ email: "b@example.com", name: "B", googleId: "g-b" }))!;
  t("users are created with lower-case email", a.email === "a@example.com" && !!a.id && !!a.createdAt);
  t("duplicate email is refused", (await users.create({ email: "a@example.com", name: "A2" })) === null);
  t("find by id, email and Google id", (await users.byId(a.id))?.name === "A" && (await users.byEmail("A@EXAMPLE.COM"))?.id === a.id && (await users.byGoogleId("g-b"))?.id === b.id);
  t("update links a Google id", (await users.update(a.id, { googleId: "g-a" }))?.googleId === "g-a" && (await users.byGoogleId("g-a"))?.id === a.id);
  t("missing users are null", (await users.byId("nope")) === null && (await users.update("nope", { name: "x" })) === null);

  const d1 = { ...house, id: "design-one", name: "One" },
    d2 = { ...createDesign({ width: 20, length: 40, floors: 1 }), id: "design-two", name: "Two" };
  t("create stores a design", (await designs.create(a.id, d1))?.design.rooms.length === house.rooms.length);
  await new Promise((r) => setTimeout(r, 5));
  await designs.create(a.id, d2);
  t("an id cannot be created twice", (await designs.create(b.id, d1)) === null);
  const list = await designs.list(a.id);
  t("list is newest first, summarised", list.map((s) => s.id).join() === "design-two,design-one" && list[1]!.rooms === house.rooms.length && list[1]!.floors === 2);
  t("other users see nothing", (await designs.list(b.id)).length === 0 && (await designs.get(b.id, "design-one")) === null);
  t("the design round-trips exactly", JSON.stringify((await designs.get(a.id, "design-one"))!.design) === JSON.stringify(d1));
  const renamed = { ...d1, name: "Renamed", revision: 7 };
  await new Promise((r) => setTimeout(r, 5));
  const saved = await designs.save(a.id, "design-one", renamed);
  t("save replaces (last write wins) and bumps updatedAt", saved?.design.name === "Renamed" && (await designs.list(a.id))[0]!.id === "design-one");
  t("someone else cannot save over it", (await designs.save(b.id, "design-one", { ...d1, name: "Hijack" })) === null && (await designs.get(a.id, "design-one"))!.design.name === "Renamed");
  await designs.setShareToken(a.id, "design-one", "T".repeat(32));
  t("share token finds the design", (await designs.byShareToken("T".repeat(32)))?.id === "design-one" && (await designs.list(a.id)).find((s) => s.id === "design-one")!.shared);
  await designs.setShareToken(a.id, "design-one", null);
  t("revoked token finds nothing", (await designs.byShareToken("T".repeat(32))) === null);
  t("someone else cannot delete it", !(await designs.remove(b.id, "design-one")));
  t("the owner can delete it", (await designs.remove(a.id, "design-one")) && (await designs.get(a.id, "design-one")) === null);
}

// --- file store
{
  const dir = await mkdtemp(join(tmpdir(), "hb-store-"));
  await contract("file", new FileUserRepository(join(dir, "u.json")), new FileDesignRepository(join(dir, "d.json")));
  const mode = (await stat(join(dir, "d.json"))).mode & 0o777;
  check("file: designs file is private (600)", mode === 0o600, mode.toString(8));
  const reread = new FileDesignRepository(join(dir, "d.json"));
  check("file: data survives a restart", (await reread.list((await new FileUserRepository(join(dir, "u.json")).byEmail("a@example.com"))!.id)).length === 1);
  // Concurrent writes are serialised, none lost.
  const many = new FileDesignRepository(join(dir, "many.json"));
  await Promise.all(Array.from({ length: 20 }, (_, i) => many.create("o", { ...house, id: `d${i}` })));
  check("file: 20 concurrent creates all land", (await new FileDesignRepository(join(dir, "many.json")).list("o")).length === 20);
}
// --- MongoDB (a real mongod, in memory)
{
  let mongo: MongoMemoryServer | null = null;
  try {
    mongo = await MongoMemoryServer.create();
  } catch (e) {
    check("mongodb: test server starts (needs the mongod download)", false, e instanceof Error ? e.message : String(e));
  }
  if (mongo) {
    const m = await connectMongo(mongo.getUri(), "hb-test");
    await contract("mongodb", m.users, m.designs);
    // The routes work unchanged on Mongo.
    const app = await startApp({}, { users: m.users, designs: m.designs });
    const c = app.client();
    await c.call("/auth/signup", { body: { consent: true, name: "M", email: "m@example.com", password: "long enough pw" } });
    const made = await c.call("/designs", { body: { design: { ...house, id: "mongo-house" } } });
    check("mongodb: the API stores a design", made.status === 201 && (await c.call("/designs")).json.designs.length === 1);
    await app.close();
    await m.close();
    await mongo.stop();
  }
}

// --- HTTP: designs CRUD, ownership, share links
{
  const app = await startApp();
  const a = app.client(),
    b = app.client(),
    anon = app.client();
  await a.call("/auth/signup", { body: { consent: true, name: "A", email: "a@example.com", password: "long enough pw" } });
  await b.call("/auth/signup", { body: { consent: true, name: "B", email: "b@example.com", password: "long enough pw" } });
  const d = { ...house, id: "design-http" };
  check("designs need a session", (await anon.call("/designs")).status === 401 && (await anon.call("/designs", { body: { design: d } })).status === 401);
  check("create returns 201", (await a.call("/designs", { body: { design: d } })).status === 201);
  check("an invalid design is refused", (await a.call("/designs", { body: { design: { ...d, id: "bad-1", rooms: [...d.rooms, { ...d.rooms[0]!, id: "x" }] } } })).status === 400);
  check("a hostile id is refused", (await a.call("/designs", { body: { design: { ...d, id: "../../etc" } } })).status === 400);
  check("garbage is refused", (await a.call("/designs", { raw: "{nope" })).status === 400);
  check("list shows it", (await a.call("/designs")).json.designs[0]?.id === "design-http");
  check("read returns the design", (await a.call("/designs/design-http")).json.design.rooms.length === d.rooms.length);
  check("another user gets 404, not 403", (await b.call("/designs/design-http")).status === 404);
  const put = await a.call("/designs/design-http", { method: "PUT", body: { design: { ...d, name: "Renamed" } } });
  check("autosave PUT stores the change", put.status === 200 && (await a.call("/designs/design-http")).json.design.name === "Renamed");
  check("PUT with a mismatched id is refused", (await a.call("/designs/design-http", { method: "PUT", body: { design: { ...d, id: "other" } } })).status === 400);
  check("another user cannot PUT", (await b.call("/designs/design-http", { method: "PUT", body: { design: d } })).status === 404);
  const share = await a.call("/designs/design-http/share", { body: {} });
  const token = share.json.token as string;
  check("share returns a 32-char unguessable token", /^[A-Za-z0-9_-]{32}$/.test(token));
  check("sharing twice keeps the same link", (await a.call("/designs/design-http/share", { body: {} })).json.token === token);
  const pub = await anon.call(`/shared/${token}`);
  check("the share link works signed out", pub.status === 200 && pub.json.design.name === "Renamed");
  check("the share link reveals no owner", !pub.text.includes("ownerId") && !pub.text.includes("a@example.com"));
  check("a malformed token is 404", (await anon.call("/shared/..%2F..%2Fetc")).status === 404 && (await anon.call("/shared/short")).status === 404);
  check("others cannot share my design", (await b.call("/designs/design-http/share", { body: {} })).status === 404);
  await a.call("/designs/design-http/share", { method: "DELETE" });
  check("turning sharing off kills the link", (await anon.call(`/shared/${token}`)).status === 404);
  check("another user cannot delete", (await b.call("/designs/design-http", { method: "DELETE" })).status === 404);
  check("the owner can delete", (await a.call("/designs/design-http", { method: "DELETE" })).status === 200 && (await a.call("/designs")).json.designs.length === 0);
  const big = await a.call("/designs", { raw: JSON.stringify({ design: { ...d, id: "big", pad: "x".repeat(3_000_000) } }) });
  check("an oversize body is refused", big.status === 413);
  await app.close();
}
