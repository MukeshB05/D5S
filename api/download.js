import { Readable } from "node:stream";

/*
 * ============================================================
 * D5S DOWNLOAD PROXY — VERCEL
 * ============================================================
 *
 * URL:
 *   /api/download?url=https://...
 *
 * Features:
 *   - HTTP / HTTPS validation
 *   - Allowed CDN host validation
 *   - Redirect validation
 *   - Range request support
 *   - Streaming response
 *   - Content-Length forwarding
 *   - Content-Range forwarding
 *   - Content-Type forwarding
 *   - No server-side buffering
 *   - Useful JSON errors
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

const isAllowedHost = (hostname) => {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");

  return ALLOWED_HOSTS.some(
    (allowedHost) =>
      host === allowedHost ||
      host.endsWith(`.${allowedHost}`)
  );
};

/* ============================================================
   URL VALIDATION
============================================================ */

const parseAllowedUrl = (value) => {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid download URL.");
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are supported."
    );
  }

  if (!isAllowedHost(parsed.hostname)) {
    throw new Error(
      `Host is not allowed: ${parsed.hostname}`
    );
  }

  return parsed;
};

/* ============================================================
   REQUEST URL
============================================================ */

const getRequestUrl = (req) => {
  const value = req?.query?.url;

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return typeof value === "string"
    ? value
    : "";
};

/* ============================================================
   REQUEST HEADERS
============================================================ */

const getForwardHeaders = (req) => {
  const headers = {};

  const range = req?.headers?.range;

  if (range) {
    headers.Range = range;
  }

  const ifRange =
    req?.headers?.["if-range"];

  if (ifRange) {
    headers["If-Range"] = ifRange;
  }

  return headers;
};

/* ============================================================
   UPSTREAM REQUEST
============================================================ */

const fetchUpstream = async (
  initialUrl,
  req
) => {
  let target =
    parseAllowedUrl(initialUrl);

  const requestHeaders =
    getForwardHeaders(req);

  for (
    let attempt = 0;
    attempt < 6;
    attempt += 1
  ) {
    const upstream =
      await fetch(
        target.href,
        {
          method:
            req.method === "HEAD"
              ? "HEAD"
              : "GET",

          headers: {
            ...requestHeaders,

            Accept:
              req?.headers?.accept ||
              "*/*",

            "User-Agent":
              "Mozilla/5.0 (compatible; D5S Download Proxy)",
          },

          redirect: "manual",
        }
      );

    /*
     * Follow redirects manually so that every
     * redirect target is validated.
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
          "location"
        );

      if (!location) {
        throw new Error(
          "Upstream redirect has no location."
        );
      }

      const nextUrl =
        new URL(
          location,
          target
        ).href;

      target =
        parseAllowedUrl(nextUrl);

      continue;
    }

    return upstream;
  }

  throw new Error(
    "Too many upstream redirects."
  );
};

/* ============================================================
   COPY RESPONSE HEADERS
============================================================ */

const copyResponseHeaders = (
  res,
  upstream
) => {
  const contentType =
    upstream.headers.get(
      "content-type"
    ) ||
    "application/octet-stream";

  const contentLength =
    upstream.headers.get(
      "content-length"
    );

  const contentRange =
    upstream.headers.get(
      "content-range"
    );

  const acceptRanges =
    upstream.headers.get(
      "accept-ranges"
    );

  const etag =
    upstream.headers.get(
      "etag"
    );

  const lastModified =
    upstream.headers.get(
      "last-modified"
    );

  const contentDisposition =
    upstream.headers.get(
      "content-disposition"
    );

  res.setHeader(
    "Content-Type",
    contentType
  );

  if (contentLength) {
    res.setHeader(
      "Content-Length",
      contentLength
    );
  }

  if (contentRange) {
    res.setHeader(
      "Content-Range",
      contentRange
    );
  }

  res.setHeader(
    "Accept-Ranges",
    acceptRanges || "bytes"
  );

  if (etag) {
    res.setHeader(
      "ETag",
      etag
    );
  }

  if (lastModified) {
    res.setHeader(
      "Last-Modified",
      lastModified
    );
  }

  if (contentDisposition) {
    res.setHeader(
      "Content-Disposition",
      contentDisposition
    );
  }

  /*
   * Do not cache large music files on the proxy.
   */
  res.setHeader(
    "Cache-Control",
    "private, no-store, max-age=0"
  );

  /*
   * Useful for browser streaming.
   */
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
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
};

/* ============================================================
   JSON ERROR
============================================================ */

const sendError = (
  res,
  status,
  message
) => {
  if (res.headersSent) {
    return;
  }

  return res
    .status(status)
    .json({
      error: message,
    });
};

/* ============================================================
   VERCEL HANDLER
============================================================ */

export default async function handler(
  req,
  res
) {
  /*
   * OPTIONS
   */
  if (req.method === "OPTIONS") {
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, HEAD, OPTIONS"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Range, If-Range, Content-Type"
    );

    res.setHeader(
      "Access-Control-Max-Age",
      "86400"
    );

    return res.status(204).end();
  }

  /*
   * GET / HEAD only.
   */
  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {
    res.setHeader(
      "Allow",
      "GET, HEAD, OPTIONS"
    );

    return sendError(
      res,
      405,
      "Method not allowed."
    );
  }

  /*
   * Get target URL.
   */
  const targetUrl =
    getRequestUrl(req);

  if (!targetUrl) {
    return sendError(
      res,
      400,
      "Missing url parameter."
    );
  }

  /*
   * Validate before making request.
   */
  try {
    parseAllowedUrl(
      targetUrl
    );
  } catch (error) {
    const message =
      error?.message ||
      "Invalid URL.";

    const status =
      message.startsWith(
        "Host is not allowed"
      )
        ? 403
        : 400;

    return sendError(
      res,
      status,
      message
    );
  }

  try {
    const upstream =
      await fetchUpstream(
        targetUrl,
        req
      );

    /*
     * Upstream failure.
     */
    if (
      !upstream.ok &&
      upstream.status !== 206
    ) {
      let details = "";

      try {
        details =
          await upstream.text();

        details =
          details
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);
      } catch {
        // Ignore.
      }

      return sendError(
        res,
        upstream.status >= 400 &&
          upstream.status <= 599
          ? upstream.status
          : 502,
        details ||
          `Upstream request failed with HTTP ${upstream.status}.`
      );
    }

    /*
     * Copy media headers.
     */
    copyResponseHeaders(
      res,
      upstream
    );

    /*
     * HEAD request.
     */
    if (
      req.method === "HEAD"
    ) {
      return res.end();
    }

    /*
     * No response body.
     */
    if (!upstream.body) {
      return res.end();
    }

    /*
     * Stream Web ReadableStream
     * directly into Node response.
     */
    const stream =
      Readable.fromWeb(
        upstream.body
      );

    stream.on(
      "error",
      (error) => {
        console.error(
          "D5S Vercel download stream error:",
          error
        );

        if (!res.destroyed) {
          res.destroy(error);
        }
      }
    );

    stream.pipe(res);
  } catch (error) {
    console.error(
      "D5S Vercel download error:",
      error
    );

    if (res.headersSent) {
      if (!res.destroyed) {
        res.end();
      }

      return;
    }

    return sendError(
      res,
      502,
      error?.message ||
        "Could not fetch the media file."
    );
  }
}
