import { Channel } from "@/data/channels";

function beinDisplayName(raw: string): string {
  const text = raw.replace(/^┃AR┃\s*/i, "").replace(/\s+/g, " ").trim();
  const slotMatch = text.match(/\sS(\d+)$/i);
  const slot = slotMatch && slotMatch[1] !== "1" ? ` S${slotMatch[1]}` : "";
  const core = text.replace(/\sS\d+$/i, "");

  if (/NEWS/i.test(core)) return `Bein Sports News HD${slot}`;
  if (/GLOBAL/i.test(core)) return `Bein Sports Global HD${slot}`;

  const numbered = core.match(/BEIN SPORTS\s+(\d+)/i);
  if (numbered) return `Bein Sports HD${numbered[1]}${slot}`;

  return text;
}

export function parseM3u(text: string, source: "4k" | "hevc"): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  let name = "";
  let logoFromList = "";
  let extinf = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      extinf = line;
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      logoFromList = logoMatch?.[1] || "";
      name = line.split(",").slice(1).join(",").trim();
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!name || !/^https?:\/\//i.test(line)) continue;

    const clean = name.replace(/^┃AR┃\s*/i, "").trim();
    const pretty = beinDisplayName(clean);
    const id = `bein-${source}-${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    channels.push({
      id,
      name: pretty,
      displayName: pretty,
      category: "Sports",
      categoryKey: "sports",
      type: "Static",
      streamUrl: line,
      description: source === "4k" ? "beIN Sports 4K" : "beIN Sports HEVC",
      currentShow: source === "4k" ? "4K feed" : "HD feed",
      presenter: "beIN Sports",
      viewers: "—",
      viewersNum: 0,
      avatar: "",
      logoUrl: logoFromList || "/images/logos/beinsport.svg",
      posterGradient: "from-zinc-800 to-zinc-950",
      themeColor: "#dc2626",
      accentRgb: "220, 38, 38",
      tags: ["beIN", source.toUpperCase()],
      quality: source === "4k" ? "4K" : "HD",
      sourceRaw: {
        playlist: source,
        extinf,
        name,
        tvgLogo: logoFromList,
        url: line,
      },
    });
    name = "";
    logoFromList = "";
    extinf = "";
  }

  return channels;
}

export async function fetchBeinPlaylistRaw(): Promise<{ path: string; ok: boolean; text: string }[]> {
  const files = [
    "/playlists/beinsports/bein-sports-4k.m3u",
    "/playlists/beinsports/bein-sports-hevc.m3u",
  ];
  return Promise.all(
    files.map(async (path) => {
      const res = await fetch(path);
      return { path, ok: res.ok, text: res.ok ? await res.text() : "" };
    })
  );
}

export async function loadBeinChannels(): Promise<Channel[]> {
  const files = [
    { path: "/playlists/beinsports/bein-sports-4k.m3u", source: "4k" as const },
    { path: "/playlists/beinsports/bein-sports-hevc.m3u", source: "hevc" as const },
  ];
  const groups = await Promise.all(
    files.map(async (file) => {
      const res = await fetch(file.path);
      if (!res.ok) return [];
      return parseM3u(await res.text(), file.source);
    })
  );
  return groups.flat().sort(compareBeinChannels);
}

function beinSlot(name: string): number {
  const slot = name.match(/\sS(\d+)/i);
  return slot ? parseInt(slot[1], 10) : 1;
}

function compareBeinChannels(a: Channel, b: Channel): number {
  const rank = (ch: Channel) => {
    const n = ch.displayName;
    if (/news/i.test(n)) return [2, 99, 99, n.includes("hevc") ? 1 : 0] as const;
    if (/global/i.test(n)) return [1, 0, beinSlot(n), ch.id.includes("-hevc-") ? 1 : 0] as const;
    const hd = n.match(/HD(\d+)/i);
    if (hd) return [0, parseInt(hd[1], 10), beinSlot(n), ch.id.includes("-hevc-") ? 1 : 0] as const;
    return [3, 99, 99, 0] as const;
  };
  const aa = rank(a);
  const bb = rank(b);
  for (let i = 0; i < 4; i += 1) {
    if (aa[i] !== bb[i]) return aa[i] - bb[i];
  }
  return a.displayName.localeCompare(b.displayName);
}
