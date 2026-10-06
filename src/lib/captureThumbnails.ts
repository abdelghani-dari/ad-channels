import { Channel } from "@/data/channels";
import { resolveStreamUrl } from "@/lib/streamResolver";
import { attachStream, chromeNeedsHevcWasm, isMpegTsUrl, type StreamHandle } from "@/lib/attachStream";
import { isSmartTvBrowser } from "@/lib/tvBrowser";

const HLS_THUMB_CONCURRENCY = 1;
const MPEGTS_THUMB_CONCURRENCY = 1;
const HLS_CAPTURE_MS = 3500;
const MPEGTS_CAPTURE_MS = 4000;
const WASM_CAPTURE_MS = 9000;

function mergeAbort(parent: AbortSignal, timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const local = new AbortController();
  const timer = window.setTimeout(() => local.abort(), timeoutMs);
  const onParent = () => local.abort();
  if (parent.aborted) local.abort();
  else parent.addEventListener("abort", onParent, { once: true });
  return {
    signal: local.signal,
    cancel: () => {
      window.clearTimeout(timer);
      parent.removeEventListener("abort", onParent);
    },
  };
}

const dataUrlCache = new Map<string, string>();
const stillCache = new Map<string, HTMLCanvasElement>();

export function getThumbnailDataUrl(channelId: string): string | undefined {
  return dataUrlCache.get(channelId);
}

export function getThumbnailStill(channelId: string): HTMLCanvasElement | undefined {
  return stillCache.get(channelId);
}

export type CaptureResult = {
  frame: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
};

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function snapshotVideo(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = Math.max(1, Math.round((320 * video.videoHeight) / video.videoWidth));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function isMostlyBlack(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let lit = 0;
    let samples = 0;
    for (let i = 0; i < data.length; i += 48) {
      samples += 1;
      if (data[i] + data[i + 1] + data[i + 2] > 40) lit += 1;
    }
    return samples > 0 && lit / samples < 0.02;
  } catch {
    return false;
  }
}

function storeDataUrl(channelId: string, dataUrl: string, snap?: HTMLCanvasElement): string {
  dataUrlCache.set(channelId, dataUrl);
  if (snap) stillCache.set(channelId, snap);
  return dataUrl;
}

async function snapFromDataUrl(channelId: string, dataUrl: string): Promise<string | null> {
  if (!dataUrl.startsWith("data:")) return null;
  const img = new Image();
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
  if (!loaded || !img.width) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = Math.max(1, Math.round((320 * img.height) / img.width));
  const ctx = canvas.getContext("2d");
  if (!ctx) return storeDataUrl(channelId, dataUrl);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (isMostlyBlack(canvas)) return null;
  return storeSnap(channelId, canvas);
}

function storeSnap(channelId: string, snap: HTMLCanvasElement): string | null {
  stillCache.set(channelId, snap);
  try {
    const dataUrl = snap.toDataURL("image/jpeg", 0.55);
    dataUrlCache.set(channelId, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

function detectAudio(video: HTMLVideoElement): boolean {
  const node = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };
  if (node.mozHasAudio) return true;
  if (node.audioTracks && node.audioTracks.length > 0) return true;
  if ((node.webkitAudioDecodedByteCount || 0) > 0) return true;
  return false;
}

function cachedSuccess(channelId: string): CaptureResult | null {
  const frame = dataUrlCache.get(channelId);
  if (!frame) return null;
  return { frame, hasVideo: true, hasAudio: true };
}

export function captureFromVideo(channelId: string, video: HTMLVideoElement): string | null {
  const snap = snapshotVideo(video);
  if (!snap || isMostlyBlack(snap)) return null;
  return storeSnap(channelId, snap);
}

export async function captureOne(
  channel: Channel,
  signal: AbortSignal,
  force = false
): Promise<CaptureResult> {
  if (isSmartTvBrowser()) {
    return cachedSuccess(channel.id) || { frame: null, hasVideo: false, hasAudio: false };
  }
  if (!force) {
    const cached = cachedSuccess(channel.id);
    if (cached) return cached;
  }

  const mpegts = isMpegTsUrl(channel.streamUrl);
  const useWasm = mpegts && chromeNeedsHevcWasm();
  let deadline: { signal: AbortSignal; cancel: () => void } | null = null;

  const stage = document.createElement("div");
  stage.style.cssText =
    "position:fixed;left:-480px;top:0;width:320px;height:180px;overflow:hidden;pointer-events:none;z-index:-1;opacity:0.02;";
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "true");
  video.className = "h-full w-full";
  stage.appendChild(video);
  document.body.appendChild(stage);

  const session: { handle: StreamHandle | null; done: boolean } = { handle: null, done: false };

  const cleanup = () => {
    session.done = true;
    try {
      video.pause();
      video.removeAttribute("src");
    } catch {
      /* ignore */
    }
    try {
      session.handle?.destroy();
    } catch {
      /* ignore */
    }
    session.handle = null;
    stage.remove();
    deadline?.cancel();
  };

  try {
    if (signal.aborted) return cachedSuccess(channel.id) || { frame: null, hasVideo: false, hasAudio: false };
    const streamUrl = await resolveStreamUrl(channel);
    if (signal.aborted) return cachedSuccess(channel.id) || { frame: null, hasVideo: false, hasAudio: false };

    deadline = mergeAbort(signal, useWasm ? WASM_CAPTURE_MS : mpegts ? MPEGTS_CAPTURE_MS : HLS_CAPTURE_MS);
    const live = deadline.signal;

    const attached = attachStream(video, streamUrl, {
      lowQuality: true,
      muted: true,
      container: stage,
      engine: useWasm ? "wasm" : "auto",
    })
      .then((handle) => {
        if (session.done || live.aborted) {
          try {
            handle.destroy();
          } catch {
            /* ignore */
          }
          return null;
        }
        return handle;
      })
      .catch(() => null);
    const aborted = new Promise<null>((resolve) => {
      if (live.aborted) {
        resolve(null);
        return;
      }
      live.addEventListener("abort", () => resolve(null), { once: true });
    });
    session.handle = (await Promise.race([attached, aborted])) || null;
    if (live.aborted) return cachedSuccess(channel.id) || { frame: null, hasVideo: false, hasAudio: false };
    if (!session.handle) return cachedSuccess(channel.id) || { frame: null, hasVideo: false, hasAudio: false };

    video.play().catch(() => {});
    session.handle.play?.().catch(() => {});

    const trySnap = async (): Promise<CaptureResult | null> => {
      if (session.handle?.grabFrame) {
        const grabbed = await session.handle.grabFrame();
        if (grabbed) {
          const frame = await snapFromDataUrl(channel.id, grabbed);
          if (frame) return { frame, hasVideo: true, hasAudio: true };
        }
      }
      const frame = captureFromVideo(channel.id, video);
      if (frame) return { frame, hasVideo: true, hasAudio: true };
      return null;
    };

    while (!live.aborted) {
      const hit = await trySnap();
      if (hit) return hit;
      await wait(useWasm ? 220 : mpegts ? 140 : 120, live);
    }

    const previous = cachedSuccess(channel.id);
    if (previous) return previous;

    const hasVideo = video.videoWidth > 2;
    const hasAudio = detectAudio(video) || video.readyState >= 2 || Boolean(session.handle?.usesCanvas);
    return { frame: null, hasVideo, hasAudio };
  } catch {
    return cachedSuccess(channel.id) || { frame: null, hasVideo: false, hasAudio: false };
  } finally {
    cleanup();
  }
}

export async function captureOneWithRetry(
  channel: Channel,
  signal: AbortSignal,
  force = true,
  extraTries = 2
): Promise<CaptureResult> {
  let last: CaptureResult = { frame: null, hasVideo: false, hasAudio: false };
  for (let attempt = 0; attempt <= extraTries; attempt += 1) {
    if (signal.aborted) return cachedSuccess(channel.id) || last;
    last = await captureOne(channel, signal, force || attempt > 0);
    if (last.frame) return last;
    await wait(80, signal);
  }
  return cachedSuccess(channel.id) || last;
}

async function runPool(
  items: Channel[],
  limit: number,
  worker: (channel: Channel) => Promise<void>,
  signal: AbortSignal
): Promise<void> {
  if (items.length === 0 || signal.aborted) return;
  let cursor = 0;
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (!signal.aborted) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        try {
          await worker(items[index]);
        } catch {
          /* ignore */
        }
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
    })
  );
}

export async function runThumbQueue(
  channels: Channel[],
  handlers: {
    onStart?: (channelId: string) => void;
    onCaptured: (channelId: string, result: CaptureResult) => void;
    onDone?: () => void;
  },
  signal: AbortSignal,
  options: { skipId?: string; getSkipId?: () => string | undefined; force?: boolean } = {}
): Promise<void> {
  if (isSmartTvBrowser()) {
    handlers.onDone?.();
    return;
  }
  try {
    const skipOf = () => options.getSkipId?.() ?? options.skipId;
    const playing = channels.find((channel) => channel.id === skipOf());
    const skipMpegtsThumbs = Boolean(playing && isMpegTsUrl(playing.streamUrl));
    const pending = channels.filter((channel) => channel.id !== skipOf());
    const hls = pending.filter((channel) => !isMpegTsUrl(channel.streamUrl));
    const mpegts = skipMpegtsThumbs ? [] : pending.filter((channel) => isMpegTsUrl(channel.streamUrl));

    for (const channel of hls) {
      if (signal.aborted) break;
      if (channel.type !== "EasyBroadcast") continue;
      try {
        await resolveStreamUrl(channel);
      } catch {
        /* ignore */
      }
    }

    const work = async (channel: Channel) => {
      if (signal.aborted) return;
      if (channel.id === skipOf()) return;
      handlers.onStart?.(channel.id);
      const result = await captureOneWithRetry(channel, signal, options.force ?? true, 3);
      handlers.onCaptured(channel.id, result);
    };

    await runPool(hls, HLS_THUMB_CONCURRENCY, work, signal);
    await runPool(mpegts, MPEGTS_THUMB_CONCURRENCY, work, signal);
  } finally {
    handlers.onDone?.();
  }
}
