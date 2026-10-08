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

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP(S) URLs are supported");
  }

  if (!isAllowedHost(url.hostname)) {
    throw new Error("Host is not allowed");
  }

  return url;
};

const fetchUpstream = async (initialUrl, request) => {
  let target = parseAllowedUrl(initialUrl);

  const headers = new Headers();
  const range = request.headers.get("Range");
  const ifRange = request.headers.get("If-Range");

  if (range) headers.set("Range", range);
  if (ifRange) headers.set("If-Range", ifRange);

  for (let attempt = 0; attempt <= 4; attempt += 1) {
    const response = await fetch(target.toString(), {
      method: request.method,
      headers,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    if (attempt === 4) {
      throw new Error("Too many upstream redirects");
    }

    const location = response.headers.get("Location");
    if (!location) {
      throw new Error("Upstream redirect has no location");
    }

    target = parseAllowedUrl(new URL(location, target).toString());
  }

  throw new Error("Too many upstream redirects");
};

const copyHeaders = (upstream) => {
  const headers = new Headers();

  const allowed = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ];

  for (const name of allowed) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag, Last-Modified"
  );

  return headers;
};

export async function onRequestOptions() {
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

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" },
      }
    );
  }

  const rawUrl = new URL(request.url).searchParams.get("url");

  if (!rawUrl) {
    return Response.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetchUpstream(rawUrl, request);

    if (!upstream.ok && upstream.status !== 206) {
      return Response.json(
        { error: `Upstream request failed: ${upstream.status}` },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }

    return new Response(
      request.method === "HEAD" ? null : upstream.body,
      {
        status: upstream.status,
        headers: copyHeaders(upstream),
      }
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error?.message || "Could not fetch the media file",
      },
      { status: 502 }
    );
  }
}
