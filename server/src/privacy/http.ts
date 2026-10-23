import type { RequestHandler } from "express";

/** API controls, not a substitute for HTTPS and headers on the deployed frontend host. */
export function privacyHttp(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if ((origin && !allowed.has(origin)) || (!origin && req.get("sec-fetch-site") === "cross-site"))
        return void res.status(403).json({ error: "This request did not come from an allowed site." });
    }
    next();
  };
}
