import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";

/** What a product page told us. Dimensions are never guessed: the person confirms them. */
export type ProductDraft = { name: string | null; imageUrl: string | null; price: number | null; currency: string | null; sourceUrl: string };
export type PreviewResult =
  | { status: "ok"; draft: ProductDraft }
  | { status: "blocked"; reason: string }
  | { status: "no-data"; reason: string };

/** A URL we refuse to fetch at all: not http(s), or pointing inside a private network. */
export class UnsafeUrlError extends Error {}

const TIMEOUT_MS = 8000,
  MAX_BYTES = 2 * 1024 * 1024,
  MAX_REDIRECTS = 3,
  USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Loopback, private, link-local, CGNAT, multicast and reserved ranges are all off limits. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]!);
  // The URL parser rewrites mapped addresses in hex: [::ffff:127.0.0.1] becomes ::ffff:7f00:1.
  const hex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1]!, 16),
      lo = parseInt(hex[2]!, 16);
    return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff") || v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8");
}
/** Check a URL before any connection is made. */
export function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That is not a web address.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UnsafeUrlError("Only http and https links can be imported.");
  if (u.username || u.password) throw new UnsafeUrlError("Links with a username or password cannot be imported.");
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) throw new UnsafeUrlError("That port is not allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new UnsafeUrlError("That address is inside a private network.");
  if (isIP(host) && isPrivateAddress(host)) throw new UnsafeUrlError("That address is inside a private network.");
  return u;
}
/**
 * The resolver every connection goes through, so a host that resolves to a private
 * address is refused at connect time too (no DNS rebinding between check and fetch).
 */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as unknown as LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) return callback(new UnsafeUrlError("That address is inside a private network."), "", 0);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

type Fetched = { status: number; url: string; contentType: string; body: string; truncated: boolean };
export type PageFetcher = (url: URL, signal: AbortSignal) => Promise<{ status: number; location?: string; contentType: string; body: string; truncated: boolean }>;

/** One GET with the safe resolver, no automatic redirects, and a hard byte cap. */
export const makeNodeFetcher = ({ lookup = safeLookup, maxBytes = MAX_BYTES }: { lookup?: LookupFunction; maxBytes?: number } = {}): PageFetcher => (url, signal) =>
  new Promise((resolve, reject) => {
    const MAX_BYTES = maxBytes,
      lib = url.protocol === "https:" ? https : http;
    const req = lib.get(url, { lookup, signal, headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "accept-language": "en-IN,en;q=0.8" } }, (res) => {
      const status = res.statusCode ?? 0,
        contentType = String(res.headers["content-type"] ?? ""),
        location = typeof res.headers.location === "string" ? res.headers.location : undefined;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ status, location, contentType, body: "", truncated: false });
      }
      const chunks: Buffer[] = [];
      let size = 0,
        truncated = false;
      res.on("data", (c: Buffer) => {
        if (truncated) return;
        size += c.length;
        if (size > MAX_BYTES) {
          truncated = true;
          chunks.push(c.subarray(0, c.length - (size - MAX_BYTES)));
          res.destroy();
          return resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8"), truncated });
        }
        chunks.push(c);
      });
      res.on("end", () => resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8"), truncated }));
      res.on("error", (e) => (truncated ? undefined : reject(e)));
    });
    req.on("error", reject);
  });
export const nodeFetcher = makeNodeFetcher();

/** Follow at most three redirects, checking every hop before connecting to it. */
async function fetchPage(start: URL, fetcher: PageFetcher, timeoutMs: number): Promise<Fetched> {
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let url = start;
    for (let hop = 0; ; hop++) {
      const r = await fetcher(url, ctl.signal);
      if (r.status >= 300 && r.status < 400 && r.location) {
        if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
        url = assertPublicUrl(new URL(r.location, url).toString());
        continue;
      }
      return { status: r.status, url: url.toString(), contentType: r.contentType, body: r.body, truncated: r.truncated };
    }
  } finally {
    clearTimeout(timer);
  }
}

const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39|#x27|apos|nbsp);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'", apos: "'", nbsp: " " })[e] ?? "").replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
function metaTags(html: string) {
  const out = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
    const key = attr("property") ?? attr("name") ?? attr("itemprop"),
      content = attr("content");
    if (key && content) {
      const k = (key[2] ?? key[3] ?? "").toLowerCase();
      if (!out.has(k)) out.set(k, decode(content[2] ?? content[3] ?? ""));
    }
  }
  return out;
}
type Json = Record<string, unknown>;
function productsIn(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((n) => productsIn(n, out));
  else if (node && typeof node === "object") {
    const o = node as Json,
      type = o["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) out.push(o);
    if (o["@graph"]) productsIn(o["@graph"], out);
  }
  return out;
}
const firstString = (v: unknown): string | null =>
  typeof v === "string" ? v : Array.isArray(v) ? firstString(v[0]) : v && typeof v === "object" ? firstString((v as Json).url ?? (v as Json).contentUrl) : null;
const toPrice = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1e9 ? n : null;
};

/** Read Open Graph and JSON-LD Product markup. Never infers a size. */
export function extractProduct(html: string, pageUrl: string): ProductDraft {
  const meta = metaTags(html);
  let name: string | null = meta.get("og:title") ?? meta.get("twitter:title") ?? null,
    image: string | null = meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image") ?? null,
    price = toPrice(meta.get("product:price:amount") ?? meta.get("og:price:amount")),
    currency = meta.get("product:price:currency") ?? meta.get("og:price:currency") ?? null;
  for (const block of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(block[1]!.trim());
    } catch {
      continue;
    }
    const p = productsIn(data)[0];
    if (!p) continue;
    name = (typeof p.name === "string" && p.name) || name;
    image = firstString(p.image) ?? image;
    const offers = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as Json | undefined;
    if (offers) {
      price = toPrice(offers.price ?? offers.lowPrice ?? (offers.priceSpecification as Json | undefined)?.price) ?? price;
      currency = (typeof offers.priceCurrency === "string" && offers.priceCurrency) || currency;
    }
    break;
  }
  if (!name) {
    const t = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
    name = t ? decode(t[1]!) : null;
  }
  let imageUrl: string | null = null;
  if (image)
    try {
      const u = new URL(decode(image), pageUrl);
      if (u.protocol === "https:" || u.protocol === "http:") imageUrl = u.toString();
    } catch {}
  return {
    name: name ? name.replace(/\s+/g, " ").trim().slice(0, 150) || null : null,
    imageUrl,
    price,
    currency: currency && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : null,
    sourceUrl: pageUrl,
  };
}

/**
 * Fetch a product page and say what it holds: `ok` with a draft, `blocked` when the site
 * refused us, or `no-data` when it answered without product markup. Unsafe URLs throw.
 */
export async function fetchProductPreview(raw: string, fetcher: PageFetcher = nodeFetcher, timeoutMs = TIMEOUT_MS): Promise<PreviewResult> {
  const url = assertPublicUrl(raw);
  let page: Fetched;
  try {
    page = await fetchPage(url, fetcher, timeoutMs);
  } catch (e) {
    if (e instanceof UnsafeUrlError) throw e;
    const why = e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message)) ? "The site took too long to answer." : "The site could not be reached.";
    return { status: "blocked", reason: why };
  }
  if (page.status === 404 || page.status === 410) return { status: "no-data", reason: "That page does not exist." };
  if (page.status < 200 || page.status >= 300) return { status: "blocked", reason: `The site refused the request (${page.status}).` };
  if (!/html|xml/i.test(page.contentType)) return { status: "no-data", reason: "That link is not a web page." };
  const draft = extractProduct(page.body, page.url);
  // A title alone is just a web page; a product has a picture or a price as well.
  if (!draft.name || (!draft.imageUrl && draft.price === null)) return { status: "no-data", reason: "The page has no product details we can read." };
  return { status: "ok", draft };
}
