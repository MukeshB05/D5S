const ALLOWED_HOSTS = [
  "saavncdn.com",
  "jiosaavn.com",
  "jiosaavndev.vercel.app",
  "aac.saavncdn.com",
  "scdn.co",
];

const allowed = (hostname) => {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some(
    (item) => host === item || host.endsWith(`.${item}`)
  );
};

const parseAllowedUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP(S) URLs are supported");
  }

  if (!allowed(url.hostname)) {
    throw new Error("Host is not allowed");
  }

  return url;
};

const fetchValidated = async (initialUrl, request) => {
  let target = parseAllowedUrl(initialUrl);

  for (let attempt = 0; attempt <= 4; attempt += 1) {
    const headers = new Headers();
    const range = request.headers.get("range");
    const ifRange = request.headers.get("if-range");

    if (range) headers.set("Range", range);
    if (ifRange) headers.set("If-Range", ifRange);

    const response = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    if (attempt >= 4) throw new Error("Too many upstream redirects");

    const location = response.headers.get("location");
    if (!location) throw new Error("Upstream redirect has no location");

    target = parseAllowedUrl(new URL(location, target).toString());
  }

  throw new Error("Too many upstream redirects");
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, If-Range, Content-Type",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag, Last-Modified",
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { ...cors, Allow: "GET, HEAD, OPTIONS" } }
    );
  }

  const url = new URL(request.url);
  const rawUrl = url.searchParams.get("url") || "";

  if (!rawUrl) {
    return Response.json(
      { error: "Missing url parameter" },
      { status: 400, headers: cors }
    );
  }

  try {
    parseAllowedUrl(rawUrl);
  } catch (error) {
    const message = error?.message || "Invalid URL";
    return Response.json(
      { error: message },
      {
        status: message === "Host is not allowed" ? 403 : 400,
        headers: cors,
      }
    );
  }

  try {
    const upstream = await fetchValidated(rawUrl, request);

    if (!upstream.ok && upstream.status !== 206) {
      return Response.json(
        { error: `Upstream request failed: ${upstream.status}` },
        {
          status: upstream.status >= 400 && upstream.status <= 599
            ? upstream.status
            : 502,
          headers: cors,
        }
      );
    }

    const headers = new Headers(cors);
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set(
      "Accept-Ranges",
      upstream.headers.get("accept-ranges") || "bytes"
    );

    for (const name of [
      "content-length",
      "content-range",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Could not fetch the media file" },
      { status: 502, headers: cors }
    );
  }
}
