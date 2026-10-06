export type HlsVariant = {
  url: string;
  height: number;
  width: number;
  bandwidth: number;
  codecs: string;
};

function joinUrl(base: string, ref: string): string {
  try {
    const abs = new URL(ref, base);
    const master = new URL(base);
    master.searchParams.forEach((value, key) => {
      if (!abs.searchParams.has(key)) abs.searchParams.set(key, value);
    });
    return abs.toString();
  } catch {
    return ref;
  }
}

function isHevc(codecs: string): boolean {
  return /hvc1|hev1|h265/i.test(codecs);
}

function isAvc(codecs: string): boolean {
  return /avc1|avc3|h264/i.test(codecs);
}

export function canPlayVideoCodec(codecs: string): boolean {
  if (!codecs) return true;
  if (typeof MediaSource === "undefined") return !isHevc(codecs);
  const videoCodec = codecs.split(",").map((c) => c.trim()).find((c) => /avc|hvc|hev|vp0|av01/i.test(c));
  if (!videoCodec) return false;
  try {
    return MediaSource.isTypeSupported(`video/mp4; codecs="${videoCodec}"`);
  } catch {
    return !isHevc(codecs);
  }
}

export function parseHlsMaster(text: string, masterUrl: string): {
  isMaster: boolean;
  hasAudioGroup: boolean;
  variants: HlsVariant[];
} {
  const hasAudioGroup = /#EXT-X-MEDIA:.*TYPE=AUDIO/i.test(text);
  const lines = text.split(/\r?\n/);
  const variants: HlsVariant[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const next = lines[i + 1]?.trim();
    if (!next || next.startsWith("#")) continue;
    const res = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const bw = line.match(/BANDWIDTH=(\d+)/i);
    const codecs = line.match(/CODECS="([^"]+)"/i)?.[1] || "";
    const width = res ? Number(res[1]) : 0;
    const height = res ? Number(res[2]) : 0;
    if (!height && /mp4a|ac-3|ec-3/i.test(codecs) && !/avc|hvc|hev|vp0|av01/i.test(codecs)) {
      continue;
    }
    variants.push({
      url: joinUrl(masterUrl, next),
      width,
      height,
      bandwidth: bw ? Number(bw[1]) : 0,
      codecs,
    });
  }

  variants.sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth);
  return { isMaster: variants.length > 0, hasAudioGroup, variants };
}

export function pickVideoVariant(variants: HlsVariant[], lowQuality?: boolean): HlsVariant | null {
  const playable = variants.filter((v) => v.height > 0 && canPlayVideoCodec(v.codecs));
  const pool = playable.length ? playable : variants.filter((v) => v.height > 0);
  if (!pool.length) return null;
  const avc = pool.filter((v) => isAvc(v.codecs) || !isHevc(v.codecs));
  const ranked = avc.length ? avc : pool;
  if (lowQuality) return ranked[ranked.length - 1];
  return ranked[0];
}

export async function fetchPlaylistText(url: string): Promise<string | null> {
  const tries = [url, `/api/media-proxy?url=${encodeURIComponent(url)}`];
  for (const target of tries) {
    try {
      const res = await fetch(target, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.includes("#EXT")) return text;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function prepareHlsSource(
  url: string,
  lowQuality?: boolean
): Promise<{ playUrl: string; variants: HlsVariant[]; useMaster: boolean }> {
  if (!url.includes(".m3u8")) {
    return { playUrl: url, variants: [], useMaster: false };
  }
  const text = await fetchPlaylistText(url);
  if (!text) return { playUrl: url, variants: [], useMaster: false };
  const parsed = parseHlsMaster(text, url);
  if (!parsed.isMaster) {
    return { playUrl: url, variants: [], useMaster: false };
  }
  const chosen = pickVideoVariant(parsed.variants, lowQuality);
  if (parsed.hasAudioGroup && chosen) {
    return { playUrl: chosen.url, variants: parsed.variants, useMaster: false };
  }
  if (lowQuality && chosen) {
    return { playUrl: chosen.url, variants: parsed.variants, useMaster: false };
  }
  return { playUrl: url, variants: parsed.variants, useMaster: true };
}
