import { Readable } from "node:stream";

/* =========================================================
   ALLOWED MEDIA HOSTS
========================================================= */

const ALLOWED_HOSTS = [
  "saavncdn.com",
  "jiosaavn.com",
  "jiosaavndev.vercel.app",
  "aac.saavncdn.com",
  "scdn.co",
];

/* =========================================================
   HOST VALIDATION
========================================================= */

const isAllowedHost = (hostname) => {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");

  return ALLOWED_HOSTS.some(
    (allowed) =>
      host === allowed ||
      host.endsWith(`.${allowed}`)
  );
};

/* =========================================================
   GET URL PARAMETER
========================================================= */

const getTargetUrl = (req) => {
  const value = req.query?.url;

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return typeof value === "string"
    ? value
    : "";
};

/* =========================================================
   PARSE + VALIDATE URL
========================================================= */

const parseAllowedUrl = (value) => {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP(S) URLs are supported"
    );
  }

  if (!isAllowedHost(parsed.hostname)) {
    throw new Error(
      "Host is not allowed"
    );
  }

  return parsed;
};

/* =========================================================
   FETCH WITH SAFE REDIRECT VALIDATION
========================================================= */

const fetchWithValidatedRedirects = async (
  initialUrl,
  method,
  headers
) => {
  let target =
    parseAllowedUrl(initialUrl);

  const MAX_REDIRECTS = 4;

  for (
    let attempt = 0;
    attempt <= MAX_REDIRECTS;
    attempt += 1
  ) {
    const response = await fetch(
      target.toString(),
      {
        method,
        headers,
        redirect: "manual",
      }
    );

    const isRedirect =
      [301, 302, 303, 307, 308].includes(
        response.status
      );

    if (!isRedirect) {
      return response;
    }

    if (
      attempt >= MAX_REDIRECTS
    ) {
      throw new Error(
        "Too many upstream redirects"
      );
    }

    const location =
      response.headers.get(
        "location"
      );

    if (!location) {
      throw new Error(
        "Upstream redirect has no location"
      );
    }

    /*
     * new URL() correctly handles:
     *
     * /file.mp3
     * //cdn.example.com/file.mp3
     * https://cdn.example.com/file.mp3
     */
    let nextUrl;

    try {
      nextUrl = new URL(
        location,
        target
      );
    } catch {
      throw new Error(
        "Invalid upstream redirect URL"
      );
    }

    /*
     * Revalidate EVERY redirect destination.
     * This prevents an allowed CDN from redirecting
     * the server to an arbitrary host.
     */
    target =
      parseAllowedUrl(
        nextUrl.toString()
      );
  }

  throw new Error(
    "Too many upstream redirects"
  );
};

/* =========================================================
   COPY SAFE RESPONSE HEADERS
========================================================= */

const setResponseHeaders = (
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

  res.setHeader(
    "Content-Type",
    contentType
  );

  /*
   * The media is being streamed through our endpoint.
   * Do not let a CDN/browser cache an arbitrary upstream
   * response indefinitely.
   */
  res.setHeader(
    "Cache-Control",
    "private, no-store, max-age=0"
  );

  /*
   * Required by the browser-side download code.
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
    ].join(", ")
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
};

/* =========================================================
   MAIN VERCEL HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
  /*
   * Only GET and HEAD are required by the
   * browser download/player flow.
   */
  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {
    res.setHeader(
      "Allow",
      "GET, HEAD"
    );

    return res.status(405).json({
      error:
        "Method not allowed",
    });
  }

  const rawUrl =
    getTargetUrl(req);

  if (!rawUrl) {
    return res.status(400).json({
      error:
        "Missing url parameter",
    });
  }

  /*
   * Validate the original URL before fetching.
   */
  try {
    parseAllowedUrl(rawUrl);
  } catch (error) {
    const message =
      error?.message ||
      "Invalid URL";

    return res
      .status(
        message ===
          "Host is not allowed"
          ? 403
          : 400
      )
      .json({
        error: message,
      });
  }

  try {
    /*
     * Forward only the request headers that are
     * useful for media/range requests.
     */
    const headers = {};

    if (req.headers.range) {
      headers.Range =
        req.headers.range;
    }

    if (req.headers["if-range"]) {
      headers["If-Range"] =
        req.headers["if-range"];
    }

    const upstream =
      await fetchWithValidatedRedirects(
        rawUrl,
        req.method,
        headers
      );

    /*
     * A normal successful response:
     * 200 OK
     *
     * A partial media response:
     * 206 Partial Content
     */
    if (
      !upstream.ok &&
      upstream.status !== 206
    ) {
      const status =
        upstream.status >= 400 &&
        upstream.status <= 599
          ? upstream.status
          : 502;

      return res.status(status).json({
        error:
          `Upstream request failed: ${upstream.status}`,
      });
    }

    /*
     * Forward media headers.
     */
    setResponseHeaders(
      res,
      upstream
    );

    /*
     * HEAD must never send the upstream body.
     */
    if (
      req.method === "HEAD" ||
      !upstream.body
    ) {
      return res.end();
    }

    /*
     * Stream the media directly to the browser.
     * This avoids buffering the complete song in memory.
     */
    const stream =
      Readable.fromWeb(
        upstream.body
      );

    stream.on(
      "error",
      (error) => {
        console.error(
          "Download stream error:",
          error
        );

        /*
         * The response may already have started.
         * At that point we cannot safely send JSON.
         */
        if (!res.headersSent) {
          res.status(502).json({
            error:
              "Media stream failed",
          });
        } else {
          res.destroy(error);
        }
      }
    );

    stream.pipe(res);
  } catch (error) {
    console.error(
      "Download proxy error:",
      error
    );

    /*
     * If headers have already been sent, don't try
     * to write a second HTTP response.
     */
    if (res.headersSent) {
      return res.end();
    }

    return res.status(502).json({
      error:
        error?.message ||
        "Could not fetch the media file",
    });
  }
}
