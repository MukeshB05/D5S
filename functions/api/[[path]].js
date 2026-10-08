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

export async function onRequest(context) {
  const { request } = context;
  const incoming = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const pathname = incoming.pathname.replace(/^\/api/, "") || "/";
  if (!isAllowedPath(pathname)) {
    return Response.json({ error: "API route not found" }, { status: 404 });
  }

  const target = new URL(`${UPSTREAM}${pathname}`);
  target.search = incoming.search;

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: {
        Accept: request.headers.get("Accept") || "application/json",
      },
    });

    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=60");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return Response.json(
      { error: "Unable to reach the music API" },
      { status: 502 }
    );
  }
}
