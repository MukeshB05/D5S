/*
 * ============================================================
 * D5S DOWNLOAD PROXY — CLOUDFLARE PAGES
 * ============================================================
 */

const ALLOWED_HOSTS = [
  "saavncdn.com",
  "jiosaavn.com",
  "jiosaavndev.vercel.app",
];

/* ============================================================
   HOST VALIDATION
============================================================ */

const isAllowedHost = (
  hostname
) => {
  const host = String(
    hostname || ""
  )
    .toLowerCase()
    .replace(/\.$/, "");

  return ALLOWED_HOSTS.some(
    (allowedHost) =>
      host === allowedHost ||
      host.endsWith(
        `.${allowedHost}`
      )
  );
};

/* ============================================================
   URL VALIDATION
============================================================ */

const parseAllowedUrl = (
  value
) => {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Invalid download URL."
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are supported."
    );
  }

  if (
    !isAllowedHost(
      url.hostname
    )
  ) {
    throw new Error(
      `Host is not allowed: ${url.hostname}`
    );
  }

  return url;
};

/* ============================================================
   JSON RESPONSE
============================================================ */

const json = (
  message,
  status = 500
) => {
  return new Response(
    JSON.stringify({
      error: message,
    }),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store",

        "Access-Control-Allow-Origin":
          "*",
      },
    }
  );
};

/* ============================================================
   REQUEST
============================================================ */

const getTargetUrl = (
  request
) => {
  const url =
    new URL(request.url);

  return (
    url.searchParams.get(
      "url"
    ) || ""
  );
};

/* ============================================================
   UPSTREAM
============================================================ */

const fetchUpstream = async (
  initialUrl,
  request
) => {
  let target =
    parseAllowedUrl(
      initialUrl
    );

  for (
    let attempt = 0;
    attempt < 6;
    attempt += 1
  ) {
    const headers =
      new Headers();

    const range =
      request.headers.get(
        "Range"
      );

    const ifRange =
      request.headers.get(
        "If-Range"
      );

    if (range) {
      headers.set(
        "Range",
        range
      );
    }

    if (ifRange) {
      headers.set(
        "If-Range",
        ifRange
      );
    }

    headers.set(
      "Accept",
      request.headers.get(
        "Accept"
      ) || "*/*"
    );

    headers.set(
      "User-Agent",
      "Mozilla/5.0 (compatible; D5S Download Proxy)"
    );

    const upstream =
      await fetch(
        target.href,
        {
          method:
            request.method ===
            "HEAD"
              ? "HEAD"
              : "GET",

          headers,

          redirect:
            "manual",
        }
      );

    /*
     * Follow redirects manually.
     * Every new URL is validated.
     */
    if (
      upstream.status === 301 ||
      upstream.status === 302 ||
      upstream.status === 303 ||
      upstream.status === 307 ||
      upstream.status === 308
    ) {
      const location =
        upstream.headers.get(
          "Location"
        );

      if (!location) {
        throw new Error(
          "Upstream redirect has no location."
        );
      }

      target =
        parseAllowedUrl(
          new URL(
            location,
            target
          ).href
        );

      continue;
    }

    return upstream;
  }

  throw new Error(
    "Too many upstream redirects."
  );
};

/* ============================================================
   RESPONSE HEADERS
============================================================ */

const createHeaders = (
  upstream
) => {
  const headers =
    new Headers();

  headers.set(
    "Content-Type",
    upstream.headers.get(
      "Content-Type"
    ) ||
      "application/octet-stream"
  );

  const contentLength =
    upstream.headers.get(
      "Content-Length"
    );

  if (contentLength) {
    headers.set(
      "Content-Length",
      contentLength
    );
  }

  const contentRange =
    upstream.headers.get(
      "Content-Range"
    );

  if (contentRange) {
    headers.set(
      "Content-Range",
      contentRange
    );
  }

  headers.set(
    "Accept-Ranges",
    upstream.headers.get(
      "Accept-Ranges"
    ) || "bytes"
  );

  const etag =
    upstream.headers.get(
      "ETag"
    );

  if (etag) {
    headers.set(
      "ETag",
      etag
    );
  }

  const lastModified =
    upstream.headers.get(
      "Last-Modified"
    );

  if (lastModified) {
    headers.set(
      "Last-Modified",
      lastModified
    );
  }

  const contentDisposition =
    upstream.headers.get(
      "Content-Disposition"
    );

  if (contentDisposition) {
    headers.set(
      "Content-Disposition",
      contentDisposition
    );
  }

  headers.set(
    "Cache-Control",
    "private, no-store, max-age=0"
  );

  headers.set(
    "Access-Control-Allow-Origin",
    "*"
  );

  headers.set(
    "Access-Control-Expose-Headers",
    [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "Content-Type",
      "ETag",
      "Last-Modified",
      "Content-Disposition",
    ].join(", ")
  );

  return headers;
};

/* ============================================================
   CLOUDFLARE PAGES FUNCTION
============================================================ */

export const onRequest = async ({
  request,
}) => {
  /*
   * OPTIONS
   */
  if (
    request.method ===
    "OPTIONS"
  ) {
    return new Response(
      null,
      {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin":
            "*",

          "Access-Control-Allow-Methods":
            "GET, HEAD, OPTIONS",

          "Access-Control-Allow-Headers":
            "Range, If-Range, Content-Type",

          "Access-Control-Max-Age":
            "86400",
        },
      }
    );
  }

  /*
   * GET / HEAD only.
   */
  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    return json(
      "Method not allowed.",
      405
    );
  }

  /*
   * Read target.
   */
  const targetUrl =
    getTargetUrl(
      request
    );

  if (!targetUrl) {
    return json(
      "Missing url parameter.",
      400
    );
  }

  /*
   * Validate.
   */
  try {
    parseAllowedUrl(
      targetUrl
    );
  } catch (error) {
    const message =
      error?.message ||
      "Invalid URL.";

    return json(
      message,
      message.startsWith(
        "Host is not allowed"
      )
        ? 403
        : 400
    );
  }

  try {
    const upstream =
      await fetchUpstream(
        targetUrl,
        request
      );

    /*
     * Upstream failure.
     */
    if (
      !upstream.ok &&
      upstream.status !== 206
    ) {
      return json(
        `Upstream request failed with HTTP ${upstream.status}.`,
        upstream.status >= 400 &&
          upstream.status <= 599
          ? upstream.status
          : 502
      );
    }

    const headers =
      createHeaders(
        upstream
      );

    /*
     * HEAD.
     */
    if (
      request.method ===
      "HEAD"
    ) {
      return new Response(
        null,
        {
          status:
            upstream.status,
          headers,
        }
      );
    }

    /*
     * STREAM BODY DIRECTLY.
     */
    return new Response(
      upstream.body,
      {
        status:
          upstream.status,
        statusText:
          upstream.statusText,
        headers,
      }
    );
  } catch (error) {
    console.error(
      "D5S Cloudflare Pages download error:",
      error
    );

    return json(
      error?.message ||
        "Could not fetch the media file.",
      502
    );
  }
};
