import { NextRequest } from "next/server";

const PLAYER = "https://channel.aflam4you.net/playeraf.php";

function decodeEmbed(b64: string): string {
  const once = Buffer.from(b64, "base64").toString("utf8");
  const twice = Buffer.from(once, "base64").toString("utf8");
  const src = twice.match(/src=["']([^"']+)/i);
  return (src?.[1] || twice).trim();
}

async function embedFor(vid: number, server: number): Promise<string> {
  const url = `${PLAYER}?vid=${vid}&aflam_s=${server}&aflam_k=forex1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://channel.aflam4you.net/",
    },
    cache: "no-store",
  });
  if (!res.ok) return "";
  const html = await res.text();
  const match = html.match(/embed_c\s*=\s*'([^']+)'/);
  return match ? decodeEmbed(match[1]) : "";
}

function score(url: string): number {
  if (/\.m3u8(\?|$)/i.test(url)) return 3;
  if (/\.php(\?|$)/i.test(url)) return 2;
  if (/^https?:\/\//i.test(url) && !/\/e\/|\/embed\//i.test(url)) return 1;
  return 0;
}

export async function GET(request: NextRequest) {
  const vid = Number(request.nextUrl.searchParams.get("vid"));
  if (!Number.isFinite(vid) || vid <= 0) {
    return Response.json({ error: "Missing vid" }, { status: 400 });
  }

  let best = "";
  let bestScore = -1;
  for (const server of [4, 3, 1]) {
    try {
      const url = await embedFor(vid, server);
      if (!url.startsWith("http")) continue;
      const s = score(url);
      if (s > bestScore) {
        best = url;
        bestScore = s;
      }
      if (s >= 3) break;
    } catch {
      /* try next server */
    }
  }

  if (!best) return Response.json({ error: "No source" }, { status: 502 });
  return Response.json({ url: best });
}
