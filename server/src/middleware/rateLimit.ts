import type { RequestHandler } from "express";

/** A fixed one-minute window per client address. Enough to stop a stuck loop or a guesser. */
export function rateLimit(perMinute: number, message = "Too many requests. Wait a minute and try again."): RequestHandler {
  const hits = new Map<string, { at: number; n: number }>();
  return (req, res, next) => {
    const key = req.ip ?? "anon",
      now = Date.now(),
      h = hits.get(key);
    if (!h || now - h.at > 60_000) hits.set(key, { at: now, n: 1 });
    else if (++h.n > perMinute) return void res.status(429).json({ error: message });
    if (hits.size > 10_000) for (const [k, v] of hits) if (now - v.at > 60_000) hits.delete(k);
    next();
  };
}
