const ROUTE_PARAM = "__hb_path";

/** Accept both Vercel's original URL and a rewritten function-entry URL. */
export function restoreApiUrl(raw: string | undefined): string {
  const url = new URL(raw ?? "/api", "https://vercel.invalid");
  const captured = url.searchParams.getAll(ROUTE_PARAM);
  if (captured.length > 1) throw new Error("Ambiguous API route.");
  url.searchParams.delete(ROUTE_PARAM);

  let path = url.pathname;
  if (["/api", "/api/", "/api/index", "/api/index.mjs"].includes(path) && captured[0]) {
    const parts = captured[0].split("/").map((part) => decodeURIComponent(part));
    if (parts.some((part) => part === "." || part === ".." || /[\u0000-\u001f\u007f/\\?#]/.test(part)))
      throw new Error("Invalid API route.");
    path = `/api/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
  }
  const query = url.searchParams.toString();
  return path + (query ? `?${query}` : "");
}
