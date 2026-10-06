import { Channel } from "@/data/channels";

const resolvedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const inflightByChannel = new Map<string, Promise<string>>();
let tokenGate: Promise<void> = Promise.resolve();

function applyToken(url: string, token: string): string {
  const clean = token.startsWith("?") ? token.slice(1) : token;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${clean}`;
}

function withTokenGate<T>(fn: () => Promise<T>): Promise<T> {
  const run = tokenGate.then(fn, fn);
  tokenGate = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function fetchEasyBroadcastToken(baseUrl: string): Promise<string> {
  return withTokenGate(async () => {
    try {
      const res = await fetch(`/api/stream-token?baseUrl=${encodeURIComponent(baseUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.token) return String(data.token).trim();
      }
    } catch {
      /* ignore */
    }
    return "";
  });
}

async function resolveEasyBroadcast(channel: Channel): Promise<string> {
  const now = Date.now();
  const cached = resolvedUrlCache.get(channel.id);
  if (cached && cached.expiresAt > now + 20000) {
    return cached.url;
  }

  const token = channel.baseUrl ? await fetchEasyBroadcastToken(channel.baseUrl) : "";
  if (!token) return channel.streamUrl;

  const fullUrl = applyToken(channel.streamUrl, token);
  resolvedUrlCache.set(channel.id, { url: fullUrl, expiresAt: Date.now() + 90000 });
  return fullUrl;
}

export async function resolveStreamUrl(channel: Channel): Promise<string> {
  if (channel.type === "Static" || !channel.baseUrl) {
    return channel.streamUrl;
  }

  const existing = inflightByChannel.get(channel.id);
  if (existing) return existing;

  const pending = resolveEasyBroadcast(channel).finally(() => {
    inflightByChannel.delete(channel.id);
  });
  inflightByChannel.set(channel.id, pending);
  return pending;
}
