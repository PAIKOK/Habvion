import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { lookup } from "node:dns";
import { check } from "../check.js";
import { sampleHouse } from "../fixtures.js";
import type { FurnitureItem } from "@shared/types/home";
import { applyAction } from "@shared/design/reducer";
import { validateDesign } from "@shared/design/validation";
import { findFurnitureSpot, footprintBounds, validateFurniture } from "@shared/design/furniture";
import { itemFor } from "@shared/design/catalog";
import { UnsafeUrlError, assertPublicUrl, extractProduct, fetchProductPreview, isPrivateAddress, makeNodeFetcher, nodeFetcher, safeLookup, type PageFetcher } from "../../src/imports/preview.js";
import { MockMeshProvider, TripoProvider, boxGlb } from "../../src/imports/mesh.js";
import { startApp } from "../http.js";

// --- custom items on the design
{
  const { design: d } = sampleHouse();
  const item: FurnitureItem = { id: "custom-oak-sideboard", name: "Oak sideboard", category: "storage", width: 5, depth: 1.5, height: 2.8, price: 32000, suitableFor: [], colorHex: "#8a6240", shape: "cabinet", mount: "floor", sourceUrl: "https://shop.example/sideboard" };
  const added = applyAction(d, { type: "custom-item/add", item });
  check("custom-item/add puts the item on the design", added.applied && added.design.customItems?.[0]?.id === item.id);
  check("adding does not place it", added.design.furniture.length === d.furniture.length);
  check("a duplicate id is refused", !applyAction(added.design, { type: "custom-item/add", item }).applied);
  check("an id without the custom- prefix is refused", !applyAction(d, { type: "custom-item/add", item: { ...item, id: "my-sideboard" } }).applied);
  check("a catalog id is refused", !applyAction(d, { type: "custom-item/add", item: { ...item, id: "sofa-3" } }).applied);
  check("a size over 20 ft is refused", !applyAction(d, { type: "custom-item/add", item: { ...item, width: 25 } }).applied);
  check("a size under 0.1 ft is refused", !applyAction(d, { type: "custom-item/add", item: { ...item, height: 0.05 } }).applied);
  check("a bad colour is refused", !applyAction(d, { type: "custom-item/add", item: { ...item, colorHex: "red" } }).applied);
  check("an empty name is refused", !applyAction(d, { type: "custom-item/add", item: { ...item, name: " " } }).applied);
  check("the catalog lookup finds it through the design", itemFor(added.design, item.id)?.name === "Oak sideboard");
  const living = added.design.rooms.find((r) => r.type === "living")!,
    spot = findFurnitureSpot(added.design, living.id, item.id);
  check("the spot finder can place an imported item", !!spot);
  const piece = { id: "sb1", catalogId: item.id, roomId: living.id, floor: living.floor, ...spot! };
  const placed = applyAction(added.design, { type: "furniture/add", piece });
  check("an imported item places with the normal furniture action", placed.applied, placed.issues.map((i) => i.message).join("; "));
  const b = footprintBounds(item, piece);
  const turned = piece.rotation % 180 !== 0;
  check("its footprint is the confirmed size", Math.abs(b.width - (turned ? 1.5 : 5)) < 1e-9 && Math.abs(b.length - (turned ? 5 : 1.5)) < 1e-9, `${b.width}×${b.length} at ${piece.rotation}°`);
  check("it validates like any catalog piece", validateFurniture(placed.design, piece).ok);
  const refused = applyAction(placed.design, { type: "custom-item/remove", id: item.id });
  check("removing an item still in use is refused", !refused.applied && refused.issues[0]?.code === "custom-item/in-use");
  const cleared = applyAction(placed.design, { type: "furniture/delete", id: "sb1" });
  const removed = applyAction(cleared.design, { type: "custom-item/remove", id: item.id });
  check("once no piece uses it, it can be removed", removed.applied && !removed.design.customItems);
  const withModel = applyAction(added.design, { type: "custom-item/set-model", id: item.id, patch: { modelUrl: "/api/assets/abcdefghijklmnopqrstuvwxyzABCDEF.glb", meshJob: { id: "mesh-1", status: "ready" } } });
  check("set-model records the model and job", !!withModel.applied && withModel.design.customItems![0]!.modelUrl?.endsWith(".glb") === true && withModel.design.customItems![0]!.meshJob?.status === "ready");
  check("set-model never changes the size", withModel.design.customItems![0]!.width === 5);
  check("set-model refuses a foreign model URL", !applyAction(added.design, { type: "custom-item/set-model", id: item.id, patch: { modelUrl: "https://evil.example/x.glb" } }).applied);
  check("a design with imported items validates", validateDesign(withModel.design).ok);
}

// --- reading product markup (never a size)
{
  const og = `<html><head><meta property="og:title" content="Linen 3-seater &amp; cushions"><meta property="og:image" content="/img/sofa.jpg"><meta property="product:price:amount" content="45,999.00"><meta property="product:price:currency" content="inr"></head></html>`;
  const a = extractProduct(og, "https://shop.example/p/sofa");
  check("Open Graph: name, decoded", a.name === "Linen 3-seater & cushions");
  check("Open Graph: relative image made absolute", a.imageUrl === "https://shop.example/img/sofa.jpg");
  check("Open Graph: price and currency", a.price === 45999 && a.currency === "INR");
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Product"],"name":"Teak bed","image":[{"url":"https://cdn.example/bed.webp"}],"offers":[{"@type":"Offer","price":"72000","priceCurrency":"INR"}],"width":{"value":"60","unitCode":"INH"}}]}</script>`;
  const b = extractProduct(ld, "https://shop.example/bed");
  check("JSON-LD inside @graph, image object, offers array", b.name === "Teak bed" && b.imageUrl === "https://cdn.example/bed.webp" && b.price === 72000 && b.currency === "INR");
  check("no dimensions are ever extracted", !("width" in b) && !("depth" in b) && !("height" in b));
  check("broken JSON-LD is ignored", extractProduct(`<title>Shop</title><script type="application/ld+json">{oops</script>`, "https://x.example/").name === "Shop");
  check("a javascript: image is dropped", extractProduct(`<meta property="og:title" content="A"><meta property="og:image" content="javascript:alert(1)">`, "https://x.example/").imageUrl === null);
}

// --- what we refuse to fetch
{
  const refused = (u: string) => {
    try {
      assertPublicUrl(u);
      return false;
    } catch (e) {
      return e instanceof UnsafeUrlError;
    }
  };
  for (const u of ["ftp://shop.example/x", "file:///etc/passwd", "http://localhost:4000/api", "http://127.0.0.1/", "http://10.0.0.5/", "http://172.20.1.1/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://[fd00::1]/", "http://[::ffff:127.0.0.1]/", "http://user:pass@shop.example/", "http://shop.example:22/", "http://printer.local/", "http://0.0.0.0/", "not a url"])
    check(`refuses ${u}`, refused(u));
  check("allows an ordinary https shop", !refused("https://www.ikea.com/in/en/p/sofa"));
  check("private ranges", ["10.1.2.3", "100.64.0.1", "fe80::1", "fc00::5", "224.0.0.1"].every(isPrivateAddress) && !isPrivateAddress("8.8.8.8") && !isPrivateAddress("2606:4700::1111"));
  const viaDns = await new Promise<boolean>((done) => safeLookup("localhost", {}, (err) => done(err instanceof UnsafeUrlError)));
  check("the connect-time resolver refuses a name that resolves to loopback", viaDns);
}

// --- the tri-state, redirects and timeouts with a scripted site
{
  const site =
    (pages: Record<string, { status: number; location?: string; contentType?: string; body?: string }>): PageFetcher =>
    async (url) => {
      const p = pages[url.toString()] ?? { status: 404 };
      return { status: p.status, location: p.location, contentType: p.contentType ?? "text/html; charset=utf-8", body: p.body ?? "", truncated: false };
    };
  const product = `<meta property="og:title" content="Chair"><meta property="og:image" content="https://cdn.example/c.jpg">`;
  const ok = await fetchProductPreview("https://a.example/p", site({ "https://a.example/p": { status: 200, body: product } }));
  check("ok with a draft", ok.status === "ok" && ok.draft.name === "Chair");
  check("blocked when the site refuses (403)", (await fetchProductPreview("https://a.example/p", site({ "https://a.example/p": { status: 403 } }))).status === "blocked");
  check("no-data for a page without product markup", (await fetchProductPreview("https://a.example/p", site({ "https://a.example/p": { status: 200, body: "<title>Home</title>" } }))).status === "no-data");
  check("no-data for a missing page", (await fetchProductPreview("https://a.example/gone", site({}))).status === "no-data");
  check("no-data for something that is not a page", (await fetchProductPreview("https://a.example/p", site({ "https://a.example/p": { status: 200, contentType: "image/png" } }))).status === "no-data");
  const follows = await fetchProductPreview("https://a.example/p", site({ "https://a.example/p": { status: 301, location: "/q" }, "https://a.example/q": { status: 200, body: product } }));
  check("follows a redirect", follows.status === "ok");
  let threw = false;
  try {
    await fetchProductPreview("https://a.example/p", site({ "https://a.example/p": { status: 302, location: "http://169.254.169.254/" } }));
  } catch (e) {
    threw = e instanceof UnsafeUrlError;
  }
  check("a redirect into a private network is refused", threw);
  const loop = site({ "https://a.example/1": { status: 302, location: "/2" }, "https://a.example/2": { status: 302, location: "/3" }, "https://a.example/3": { status: 302, location: "/4" }, "https://a.example/4": { status: 302, location: "/5" } });
  check("more than three redirects is blocked", (await fetchProductPreview("https://a.example/1", loop)).status === "blocked");
  const slow: PageFetcher = (_u, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const timed = await fetchProductPreview("https://a.example/slow", slow, 100);
  check("a slow site times out as blocked", timed.status === "blocked" && /too long/.test(timed.reason));
}

// --- the real fetcher: a byte cap, and no connection to a private address
{
  const big = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<meta property="og:title" content="Big"><meta property="og:image" content="https://x.example/i.jpg">` + "x".repeat(300_000));
  });
  big.listen(0, "127.0.0.1");
  await once(big, "listening");
  const url = new URL(`http://127.0.0.1:${(big.address() as AddressInfo).port}/`);
  const open = makeNodeFetcher({ lookup: lookup as never, maxBytes: 50_000 });
  const r = await open(url, new AbortController().signal);
  check("the body is cut at the byte cap", r.truncated && r.body.length <= 50_000);
  let refusedConnect = false;
  try {
    await nodeFetcher(new URL(`http://localhost:${url.port}/`), new AbortController().signal);
  } catch (e) {
    refusedConnect = e instanceof UnsafeUrlError;
  }
  check("the production fetcher will not connect to localhost", refusedConnect);
  big.close();
}

// --- mesh providers
{
  const glb = boxGlb();
  check("the mock model is a binary glTF", glb.toString("ascii", 0, 4) === "glTF" && glb.readUInt32LE(8) === glb.length);
  const mock = new MockMeshProvider(),
    t = await mock.submit("https://cdn.example/c.jpg");
  check("mock: pending first", (await mock.poll(t)).status === "pending");
  check("mock: ready second", (await mock.poll(t)).status === "ready");
  let sentAuth = "";
  const tripo = new TripoProvider("test-key-not-real", "v2.5", (async (_u: string, init?: RequestInit) => {
    sentAuth = String((init?.headers as Record<string, string>).authorization);
    return new Response(JSON.stringify({ code: 0, data: { task_id: "t1" } }), { status: 200 });
  }) as typeof fetch);
  check("tripo: submit returns the task id", (await tripo.submit("https://cdn.example/c.jpg")) === "t1");
  check("tripo: the key travels only as a bearer header", sentAuth === "Bearer test-key-not-real");
  const refusedKey = new TripoProvider("k", "v", (async () => new Response("{}", { status: 401 })) as typeof fetch);
  let msg = "";
  try {
    await refusedKey.submit("https://cdn.example/c.jpg");
  } catch (e) {
    msg = (e as Error).message;
  }
  check("tripo: a refused key is a readable error without the key", /refused this API key/.test(msg) && !msg.includes("k\""));
}

// --- HTTP: auth, preview, mesh jobs and the public model route
{
  const product = `<meta property="og:title" content="Rattan armchair"><meta property="og:image" content="https://cdn.example/a.jpg"><meta property="product:price:amount" content="12999"><meta property="product:price:currency" content="INR">`;
  const fetcher: PageFetcher = async (url) => (url.hostname === "shop.example" ? { status: 200, contentType: "text/html", body: product, truncated: false } : { status: 403, contentType: "text/html", body: "", truncated: false });
  const app = await startApp({}, { fetcher });
  try {
    const anon = app.client();
    check("preview needs an account", (await anon.call("/imports/preview", { body: { url: "https://shop.example/a" } })).status === 401);
    const c = app.client();
    await c.call("/auth/signup", { body: { consent: true, name: "Asha", email: `imp-${Date.now()}@homebuilder.test`, password: "a long enough password" } });
    const ok = await c.call("/imports/preview", { body: { url: "https://shop.example/a" } });
    check("preview: ok with name, image and price", ok.status === 200 && ok.json.status === "ok" && ok.json.draft.name === "Rattan armchair" && ok.json.draft.price === 12999);
    check("preview: blocked is a normal answer, not an error", (await c.call("/imports/preview", { body: { url: "https://refuses.example/a" } })).json.status === "blocked");
    const priv = await c.call("/imports/preview", { body: { url: "http://169.254.169.254/latest" } });
    check("preview: a private address is a 400", priv.status === 400 && /private/.test(priv.json.error));
    check("preview: a missing url is a 400", (await c.call("/imports/preview", { body: {} })).status === 400);
    const job = await c.call("/imports/mesh", { body: { imageUrl: "https://cdn.example/a.jpg" } });
    check("mesh: a job starts pending", job.status === 202 && job.json.job.status === "pending");
    const id = job.json.job.id as string;
    check("mesh: first poll still pending", (await c.call(`/imports/mesh/${id}`)).json.job.status === "pending");
    const done = await c.call(`/imports/mesh/${id}`);
    const modelUrl = done.json.modelUrl as string;
    check("mesh: ready with a model URL the design schema accepts", done.json.job.status === "ready" && /^\/api\/assets\/[A-Za-z0-9_-]{32}\.glb$/.test(modelUrl), modelUrl);
    const other = app.client();
    await other.call("/auth/signup", { body: { consent: true, name: "Ravi", email: `imp2-${Date.now()}@homebuilder.test`, password: "a long enough password" } });
    check("mesh: another account cannot see the job", (await other.call(`/imports/mesh/${id}`)).status === 404);
    const file = await fetch(app.base.replace(/\/api$/, "") + modelUrl);
    const bytes = Buffer.from(await file.arrayBuffer());
    check("assets: the model is public and served as glTF binary", file.status === 200 && file.headers.get("content-type")?.startsWith("model/gltf-binary") === true && bytes.toString("ascii", 0, 4) === "glTF");
    check("assets: an unknown token is 404", (await anon.call("/assets/abcdefghijklmnopqrstuvwxyzABCDEF.glb")).status === 404);
    check("assets: a malformed name is 404", (await anon.call("/assets/short.glb")).status === 404);
    check("assets: traversal is 404", (await anon.call("/assets/..%2F..%2Fusers.json")).status === 404 && (await anon.call("/assets/%2e%2e%2fusers.glb")).status === 404);
  } finally {
    await app.close();
  }
}
