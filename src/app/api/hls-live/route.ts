import { NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set(["main.light-ott.net"]);

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

  const origin = request.nextUrl.origin;
  const segment = `${origin}/api/media-proxy?url=${encodeURIComponent(parsed.toString())}`;
  const body = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:10",
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXTINF:10.0,",
    segment,
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-store, no-transform",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
