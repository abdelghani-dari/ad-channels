import { NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set([
  "main.light-ott.net",
  "cdn.live.easybroadcast.io",
  "token.easybroadcast.io",
  "d2qh3gh0k5vp3v.cloudfront.net",
]);

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol) || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return Response.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Accept: "*/*",
        ...(request.headers.get("range") ? { Range: request.headers.get("range") as string } : {}),
      },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "Upstream failed" }, { status: upstream.status || 502 });
    }

    const type = upstream.headers.get("Content-Type") || "video/mp2t";
    return new Response(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers: {
        "Content-Type": type.includes("mpegurl") ? type : "video/mp2t",
        "Cache-Control": "no-store, no-transform",
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Proxy failed" }, { status: 502 });
  }
}
