const ALLOWED_HOSTS = [
  "saavncdn.com",
  "jiosaavn.com",
  "jiosaavndev.vercel.app",
  "aac.saavncdn.com",
  "scdn.co",
];

const isAllowedHost = (hostname) => {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
};

const parseAllowedUrl = (value) => {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP(S) URLs are supported");
  }
  if (!isAllowedHost(url.hostname)) {
    throw new Error("Host is not allowed");
  }
  return url;
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204)
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
      .setHeader("Access-Control-Allow-Headers", "Range, If-Range, Content-Type")
      .end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).setHeader("Allow", "GET, HEAD, OPTIONS").json({ error: "Method not allowed" });
    return;
  }

  const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
  if (!rawUrl) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    let target = parseAllowedUrl(rawUrl);
    let upstream;

    for (let attempt = 0; attempt <= 4; attempt += 1) {
      const headers = {};
      if (req.headers.range) headers.Range = req.headers.range;
      if (req.headers["if-range"]) headers["If-Range"] = req.headers["if-range"];

      upstream = await fetch(target.toString(), {
        method: req.method,
        headers,
        redirect: "manual",
      });

      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      if (attempt === 4) throw new Error("Too many upstream redirects");

      const location = upstream.headers.get("location");
      if (!location) throw new Error("Upstream redirect has no location");
      target = parseAllowedUrl(new URL(location, target).toString());
    }

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status >= 400 ? upstream.status : 502).json({
        error: `Upstream request failed: ${upstream.status}`,
      });
      return;
    }

    const allowedHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ];

    allowedHeaders.forEach((name) => {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    });

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag, Last-Modified"
    );

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
  } catch (error) {
    res.status(502).json({
      error: error?.message || "Could not fetch the media file",
    });
  }
}
