import { Readable } from "node:stream";

const ALLOWED_HOSTS = [
  "saavncdn.com",
  "jiosaavn.com",
  "jiosaavndev.vercel.app",
  "aac.saavncdn.com",
  "scdn.co",
];

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

const parseAllowedUrl = (value) => {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Invalid URL"
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP(S) URLs are supported"
    );
  }

  if (
    !isAllowedHost(
      url.hostname
    )
  ) {
    throw new Error(
      "Host is not allowed"
    );
  }

  return url;
};

const getTargetUrl = (req) => {
  const value =
    req.query?.url;

  if (
    Array.isArray(value)
  ) {
    return value[0] || "";
  }

  return typeof value ===
    "string"
    ? value
    : "";
};

const fetchUpstream = async (
  initialUrl,
  method,
  reqHeaders
) => {
  let target =
    parseAllowedUrl(
      initialUrl
    );

  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const headers = {};

    if (reqHeaders?.Range) {
      headers.Range =
        reqHeaders.Range;
    }

    if (reqHeaders?.["If-Range"]) {
      headers["If-Range"] =
        reqHeaders["If-Range"];
    }

    const response =
      await fetch(
        target.href,
        {
          method,
          headers,
          redirect: "manual",
        }
      );

    if (
      ![
        301,
        302,
        303,
        307,
        308,
      ].includes(
        response.status
      )
    ) {
      return response;
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

    target =
      parseAllowedUrl(
        new URL(
          location,
          target
        ).href
      );
  }

  throw new Error(
    "Too many upstream redirects"
  );
};

const setMediaHeaders = (
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
    acceptRanges ||
      "bytes"
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

  res.setHeader(
    "Cache-Control",
    "private, no-store, max-age=0"
  );

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
};

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {
    res.setHeader(
      "Allow",
      "GET, HEAD"
    );

    return res
      .status(405)
      .json({
        error:
          "Method not allowed",
      });
  }

  const rawUrl =
    getTargetUrl(req);

  if (!rawUrl) {
    return res
      .status(400)
      .json({
        error:
          "Missing url parameter",
      });
  }

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
    const upstream =
      await fetchUpstream(
        rawUrl,
        req.method,
        req.headers
      );

    if (
      !upstream.ok &&
      upstream.status !== 206
    ) {
      return res
        .status(
          upstream.status >=
            400 &&
          upstream.status <=
            599
            ? upstream.status
            : 502
        )
        .json({
          error:
            `Upstream request failed: ${upstream.status}`,
        });
    }

    setMediaHeaders(
      res,
      upstream
    );

    if (
      req.method === "HEAD" ||
      !upstream.body
    ) {
      return res.end();
    }

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

        if (
          !res.headersSent
        ) {
          res
            .status(502)
            .json({
              error:
                "Media stream failed",
            });
        } else {
          res.destroy(
            error
          );
        }
      }
    );

    stream.pipe(res);
  } catch (error) {
    console.error(
      "Download proxy error:",
      error
    );

    if (
      res.headersSent
    ) {
      return res.end();
    }

    return res
      .status(502)
      .json({
        error:
          error?.message ||
          "Could not fetch the media file",
      });
  }
}
