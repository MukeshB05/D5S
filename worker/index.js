const ALLOWED_HOSTS = [
  "saavncdn.com",
  "jiosaavn.com",
  "jiosaavndev.vercel.app",
  "aac.saavncdn.com",
  "scdn.co",
];

function isAllowedHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

function parseAllowedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP(S) URLs are supported");
  }

  if (!isAllowedHost(url.hostname)) {
    throw new Error("Host is not allowed");
  }

  return url;
}

async function fetchWithValidatedRedirects(initialUrl, request) {
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

    if (attempt >= 4) {
      throw new Error("Too many upstream redirects");
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Upstream redirect has no location");
    }

    target = parseAllowedUrl(new URL(location, target).toString());
  }

  throw new Error("Too many upstream redirects");
}

function mediaHeaders(upstream) {
  const headers = new Headers();

  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || "application/octet-stream"
  );
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag, Last-Modified"
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

  headers.set(
    "Accept-Ranges",
    upstream.headers.get("accept-ranges") || "bytes"
  );

  return headers;
}

async function downloadApi(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, If-Range, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: {
          Allow: "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const url = new URL(request.url);
  const rawUrl = url.searchParams.get("url") || "";

  if (!rawUrl) {
    return Response.json(
      { error: "Missing url parameter" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
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
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  try {
    const upstream = await fetchWithValidatedRedirects(rawUrl, request);

    if (!upstream.ok && upstream.status !== 206) {
      return Response.json(
        { error: `Upstream request failed: ${upstream.status}` },
        {
          status: upstream.status >= 400 && upstream.status <= 599
            ? upstream.status
            : 502,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    return new Response(
      request.method === "HEAD" ? null : upstream.body,
      {
        status: upstream.status,
        headers: mediaHeaders(upstream),
      }
    );
  } catch (error) {
    return Response.json(
      { error: error?.message || "Could not fetch the media file" },
      {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/download") {
      return downloadApi(request);
    }

    return env.ASSETS.fetch(request);
  },
};
