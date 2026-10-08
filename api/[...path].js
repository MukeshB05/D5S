const UPSTREAM = "https://jiosaavndev.vercel.app/api";

const ALLOWED_PREFIXES = [
  "/search",
  "/songs",
  "/albums",
  "/artists",
  "/playlists",
];

const isAllowedPath = (pathname) =>
  ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).setHeader("Access-Control-Allow-Origin", "*").setHeader("Access-Control-Allow-Methods", "GET, OPTIONS").setHeader("Access-Control-Allow-Headers", "Content-Type").end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawPath = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : String(req.query.path || "");
  const pathname = `/${rawPath}`.replace(/\/+/g, "/");

  if (!isAllowedPath(pathname)) {
    res.status(404).json({ error: "API route not found" });
    return;
  }

  const target = new URL(`${UPSTREAM}${pathname}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path" || value === undefined) continue;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => target.searchParams.append(key, String(item)));
  }

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: { Accept: req.headers.accept || "application/json" },
    });

    res.status(upstream.status);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=60");

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
  } catch (error) {
    res.status(502).json({
      error: error?.message || "Unable to reach the music API",
    });
  }
}
