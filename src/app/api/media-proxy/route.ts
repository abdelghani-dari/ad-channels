import { NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set([
  "main.light-ott.net",
  "cdn.live.easybroadcast.io",
  "token.easybroadcast.io",
  "d2qh3gh0k5vp3v.cloudfront.net",
]);

const PLAYLIST_TYPES = /mpegurl|m3u8|x-mpegURL/i;

function proxyLine(target: string, playlistUrl: URL, origin: string): string {
  const abs = new URL(target, playlistUrl).toString();
  let hostOk = false;
  try {
    hostOk = ALLOWED_HOSTS.has(new URL(abs).hostname);
  } catch {
    hostOk = false;
  }
  if (!hostOk) return abs;
  return `${origin}/api/media-proxy?url=${encodeURIComponent(abs)}`;
}

function rewritePlaylist(body: string, playlistUrl: URL, origin: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_m, uri: string) => `URI="${proxyLine(uri, playlistUrl, origin)}"`);
      }
      return proxyLine(trimmed, playlistUrl, origin);
    })
    .join("\n");
}

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

    const type = upstream.headers.get("Content-Type") || "";
    const wantsPlaylist =
      parsed.searchParams.get("extension") === "m3u8" || PLAYLIST_TYPES.test(type) || parsed.pathname.endsWith(".m3u8");

    if (wantsPlaylist) {
      const text = await upstream.text();
      if (text.trim().startsWith("#EXTM3U")) {
        const origin = request.nextUrl.origin;
        return new Response(rewritePlaylist(text, parsed, origin), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store, no-transform",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type": type || "application/octet-stream",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers: {
        "Content-Type": type || "video/mp2t",
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
