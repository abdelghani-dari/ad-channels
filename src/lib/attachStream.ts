export type PlayerEngine =
  | "auto"
  | "hls"
  | "mpegts"
  | "mse"
  | "wasm"
  | "native"
  | "vidstack"
  | "videojs"
  | "artplayer"
  | "plyr"
  | "dash";

export type QualityOption = { id: number; label: string };

export type TimelineState = {
  current: number;
  live: number;
  windowStart: number;
  bufferedStart: number;
  bufferedEnd: number;
  canSeek: boolean;
  followLive: boolean;
};

export type StreamHandle = {
  destroy: () => void;
  getQualities: () => QualityOption[];
  setQuality: (id: number) => void;
  engine: PlayerEngine;
  usesCanvas?: boolean;
  play?: () => Promise<void>;
  pause?: () => void;
  setVolume?: (value: number) => void;
  setMuted?: (muted: boolean) => void;
  grabFrame?: () => Promise<string | null>;
  getTimeline?: () => TimelineState;
  seek?: (seconds: number) => void;
  goLive?: () => void;
};

import { isSmartTvBrowser, nativeHlsSupported, prepareTvVideo } from "@/lib/tvBrowser";
import { tvOrTabPlayUrl, viaHlsWrap } from "@/lib/playableUrl";

const WASM_BASE = "/ferrite/";

function mseSupportsHevc(): boolean {
  if (typeof MediaSource === "undefined") return false;
  return [
    'video/mp4;codecs="hvc1.1.1.L123.B0"',
    'video/mp4;codecs="hev1.1.1.L123.B0"',
    'video/mp4;codecs="hvc1.1.1.L93.B0"',
    "video/mp4;codecs=hvc1",
  ].some((type) => {
    try {
      return MediaSource.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

function wasmHevcReady(): boolean {
  if (typeof window === "undefined" || isSmartTvBrowser()) return false;
  return Boolean(window.crossOriginIsolated) && typeof SharedArrayBuffer !== "undefined";
}

export function chromeNeedsHevcWasm(): boolean {
  if (isSmartTvBrowser()) return false;
  return wasmHevcReady() && !mseSupportsHevc();
}

export function isMpegTsUrl(url: string): boolean {
  return url.includes("extension=ts") || url.includes("/live.php");
}

const LIVE_WINDOW_SEC = 3600;

function tsPid(packet: Uint8Array): number {
  return ((packet[1] & 0x1f) << 8) | packet[2];
}

function tsPayload(packet: Uint8Array): Uint8Array | null {
  if (packet.length < 188 || packet[0] !== 0x47) return null;
  let offset = 4;
  if (packet[3] & 0x20) {
    const adapt = packet[4];
    offset += 1 + adapt;
  }
  if (!(packet[3] & 0x10) || offset >= 188) return null;
  return packet.subarray(offset, 188);
}

function scanTsCodec(buf: Uint8Array): "hevc" | "avc" | "unknown" {
  let sync = -1;
  for (let i = 0; i + 376 <= buf.length; i++) {
    if (buf[i] === 0x47 && buf[i + 188] === 0x47) {
      sync = i;
      break;
    }
  }
  if (sync < 0) return "unknown";

  const pmtPids = new Set<number>();
  let sawHevc = false;
  let sawAvc = false;

  const readSection = (payload: Uint8Array, start: boolean) => {
    if (!start || payload.length < 8) return;
    let i = 0;
    if (payload[0] < payload.length) i = 1 + payload[0];
    if (i + 8 >= payload.length) return;
    const tableId = payload[i];
    const sectionLen = ((payload[i + 1] & 0x0f) << 8) | payload[i + 2];
    const end = Math.min(payload.length, i + 3 + sectionLen);
    if (tableId === 0x00) {
      let o = i + 8;
      while (o + 4 <= end - 4) {
        const program = (payload[o] << 8) | payload[o + 1];
        const pid = ((payload[o + 2] & 0x1f) << 8) | payload[o + 3];
        if (program !== 0) pmtPids.add(pid);
        o += 4;
      }
      return;
    }
    if (tableId !== 0x02) return;
    const infoLen = ((payload[i + 10] & 0x0f) << 8) | payload[i + 11];
    let o = i + 12 + infoLen;
    while (o + 5 <= end - 4) {
      const streamType = payload[o];
      const esLen = ((payload[o + 3] & 0x0f) << 8) | payload[o + 4];
      if (streamType === 0x24 || streamType === 0x27) sawHevc = true;
      if (streamType === 0x1b || streamType === 0x20) sawAvc = true;
      o += 5 + esLen;
    }
  };

  for (let i = sync; i + 188 <= buf.length; i += 188) {
    const packet = buf.subarray(i, i + 188);
    if (packet[0] !== 0x47) {
      i = i - 187;
      continue;
    }
    const pid = tsPid(packet);
    const start = Boolean(packet[1] & 0x40);
    const payload = tsPayload(packet);
    if (!payload) continue;
    if (pid === 0 || pmtPids.has(pid)) readSection(payload, start);
  }

  if (sawHevc) return "hevc";
  if (sawAvc) return "avc";
  return "unknown";
}

async function probeTsVideo(url: string): Promise<"hevc" | "avc" | "unknown"> {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-393215" },
      cache: "no-store",
    });
    if (!res.ok) return "unknown";
    return scanTsCodec(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return "unknown";
  }
}

function rangeSpan(ranges: TimeRanges | undefined): { start: number; end: number } {
  if (!ranges || ranges.length === 0) return { start: 0, end: 0 };
  try {
    return { start: ranges.start(0), end: ranges.end(ranges.length - 1) };
  } catch {
    return { start: 0, end: 0 };
  }
}

export function bestEngineForUrl(url: string): Exclude<PlayerEngine, "auto"> {
  if (isSmartTvBrowser()) return "native";
  if (url.includes(".m3u8")) return nativeHlsSupported() ? "native" : "hls";
  if (isMpegTsUrl(url)) return wasmHevcReady() && !mseSupportsHevc() ? "wasm" : "mpegts";
  return "native";
}

export function enginesForUrl(_url: string): { id: PlayerEngine; label: string }[] {
  return [
    { id: "auto", label: "Auto" },
    { id: "hls", label: "HLS.js" },
    { id: "mpegts", label: "MPEG-TS" },
    { id: "wasm", label: "WASM HEVC" },
    { id: "mse", label: "MSE" },
    { id: "native", label: "Native" },
    { id: "vidstack", label: "Vidstack" },
    { id: "videojs", label: "Video.js" },
    { id: "artplayer", label: "ArtPlayer" },
    { id: "plyr", label: "Plyr" },
    { id: "dash", label: "Dash.js" },
  ];
}

function proxiedUrl(url: string): string {
  if (typeof window === "undefined") return url;
  if (!isMpegTsUrl(url)) return url;
  return `/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function nativeMime(url: string): string {
  if (url.includes(".m3u8")) return "application/x-mpegURL";
  if (isMpegTsUrl(url)) return "video/mp2t";
  return "";
}

function clearMedia(video: HTMLVideoElement) {
  try {
    video.pause();
  } catch {
    /* ignore */
  }
  video.querySelectorAll("source").forEach((node) => node.remove());
  try {
    video.removeAttribute("src");
    video.src = "";
  } catch {
    /* ignore */
  }
}

function waitForMedia(video: HTMLVideoElement, ms: number): Promise<boolean> {
  if (video.videoWidth > 2 && video.readyState >= 2) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("loadeddata", onPlay);
      video.removeEventListener("error", onErr);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onPlay = () => finish(true);
    const onErr = () => finish(false);
    const timer = window.setTimeout(() => {
      finish(video.readyState >= 2 || !video.paused || video.currentTime > 0);
    }, ms);
    video.addEventListener("playing", onPlay);
    video.addEventListener("loadeddata", onPlay);
    video.addEventListener("error", onErr);
  });
}

async function attachNative(video: HTMLVideoElement, src: string, mime: string): Promise<boolean> {
  prepareTvVideo(video);
  clearMedia(video);
  const tv = isSmartTvBrowser();
  const typeOk = Boolean(mime) && !tv && video.canPlayType(mime) !== "";
  if (typeOk) {
    const source = document.createElement("source");
    source.src = src;
    source.type = mime;
    video.appendChild(source);
  } else {
    video.src = src;
  }
  try {
    video.load();
  } catch {
    /* Tizen needs load(); desktop mpegts path avoids it */
  }
  video.play().catch(() => {});
  return waitForMedia(video, tv ? 8000 : 2500);
}

function emptyHandle(engine: PlayerEngine, destroy: () => void = () => {}): StreamHandle {
  return {
    destroy,
    engine,
    getQualities: () => [{ id: -1, label: "Auto" }],
    setQuality: () => {},
  };
}

function installQuietErrors() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __streamQuiet?: boolean };
  if (w.__streamQuiet) return;
  w.__streamQuiet = true;

  const noisy = (value: unknown) => {
    const msg = String(value || "");
    return (
      msg.includes("hvc1") ||
      msg.includes("hev1") ||
      msg.includes("addSourceBuffer") ||
      msg.includes("MSEController") ||
      msg.includes("_hasPendingRemoveRanges") ||
      msg.includes("play() request was interrupted") ||
      msg.includes("The operation was aborted") ||
      (msg.includes("MediaSource") && msg.includes("unsupported"))
    );
  };

  const wrap = (method: "error" | "warn" | "debug") => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      if (args.some((arg) => noisy(arg))) return;
      original(...args);
    };
  };
  wrap("error");
  wrap("warn");
  wrap("debug");

  window.addEventListener("error", (event) => {
    if (noisy(event.message) || noisy(event.error)) {
      event.preventDefault();
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (noisy((event.reason as Error)?.message) || noisy(event.reason)) {
      event.preventDefault();
    }
  });
}

type MpegPlayer = {
  pause: () => void;
  unload: () => void;
  load: () => void;
  detachMediaElement: () => void;
  destroy: () => void;
  seek?: (seconds: number) => void;
};

function mpegtsConfigOf(player: MpegPlayer | null): Record<string, unknown> | null {
  if (!player) return null;
  const raw = player as unknown as {
    _config?: Record<string, unknown>;
    _player_engine?: { _config?: Record<string, unknown> };
  };
  return raw._config || raw._player_engine?._config || null;
}

async function attachMpegts(
  video: HTMLVideoElement,
  playUrl: string,
  type: "mpegts" | "mse",
  stable: boolean
): Promise<MpegPlayer | null> {
  const mpegts = (await import("mpegts.js")).default;
  if (!mpegts.isSupported()) return null;
  try {
    mpegts.LoggingControl.enableAll = false;
    mpegts.LoggingControl.enableError = false;
    mpegts.LoggingControl.enableWarn = false;
    mpegts.LoggingControl.enableInfo = false;
    mpegts.LoggingControl.enableDebug = false;
    mpegts.LoggingControl.enableVerbose = false;
  } catch {
    /* ignore */
  }
  const tv = isSmartTvBrowser();
  const player = mpegts.createPlayer(
    { type, isLive: true, url: playUrl, hasAudio: true, hasVideo: true },
    tv || !stable
      ? {
          enableWorker: false,
          enableStashBuffer: true,
          stashInitialSize: 192 * 1024,
          lazyLoad: false,
          deferLoadAfterSourceOpen: false,
          liveBufferLatencyChasing: false,
          liveSync: false,
        }
      : {
          enableWorker: false,
          enableStashBuffer: true,
          stashInitialSize: 384 * 1024,
          lazyLoad: false,
          deferLoadAfterSourceOpen: false,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 3600,
          autoCleanupMinBackwardDuration: 3000,
          fixAudioTimestampGap: true,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 8,
          liveBufferLatencyMinRemain: 3,
          liveSync: true,
          liveSyncMaxLatency: 8,
          liveSyncTargetLatency: 4,
          liveSyncPlaybackRate: 1.04,
        }
  );
  player.on(mpegts.Events.ERROR, () => {});
  player.attachMediaElement(video);
  player.load();
  video.play().catch(() => {});
  return player;
}

type HlsSession = {
  destroy: () => void;
  recover: () => void;
  getQualities: () => QualityOption[];
  setQuality: (id: number) => void;
  setFollowLive: (on: boolean) => void;
};

type WasmPlayer = {
  pause: () => void;
  unload: () => void;
  detachMediaElement: () => void;
  destroy: () => void;
  play: () => Promise<void>;
  volume: number;
  muted: boolean;
  load: () => void;
  attachCanvas: (canvas: HTMLCanvasElement) => void;
  on: (event: string, fn: (...args: unknown[]) => void) => void;
  grabFrame?: () => Promise<string | null>;
  recover?: () => void;
  paused?: boolean;
  seek?: (seconds: number) => void;
  currentTime?: number;
  duration?: number;
  setLevers?: (levers: { present?: boolean; skipNonref?: boolean; skipLoop?: boolean }) => void;
};

function snapshotPresentWorker(worker: Worker | null): Promise<string | null> {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      worker.removeEventListener("message", onMsg);
      resolve(null);
    }, 900);
    const onMsg = (event: MessageEvent) => {
      const data = event.data as { type?: string; ok?: boolean; bytes?: ArrayBuffer };
      if (!data || data.type !== "ferriteSnapshot") return;
      worker.removeEventListener("message", onMsg);
      window.clearTimeout(timer);
      if (!data.ok || !data.bytes) {
        resolve(null);
        return;
      }
      const blob = new Blob([data.bytes], { type: "image/jpeg" });
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "") || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage({ type: "ferriteSnapshot" });
  });
}

type FerriteApi = {
  isSupported: () => boolean;
  createPlayer: (
    source: { type: string; isLive: boolean; url: string; hasAudio: boolean; hasVideo: boolean },
    config: Record<string, unknown>
  ) => WasmPlayer;
  Events: {
    TIME_UPDATE: string;
    MEDIA_INFO: string;
    STATISTICS_INFO: string;
    ERROR: string;
  };
};

async function loadFerrite(): Promise<FerriteApi | null> {
  try {
    const importer = new Function("u", "return import(u)") as (url: string) => Promise<{
      default?: FerriteApi;
    } & FerriteApi>;
    const mod = await importer(`${WASM_BASE}player.js`);
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function mountHevcCanvas(video: HTMLVideoElement, container?: HTMLDivElement | null): HTMLCanvasElement {
  const stage = video.parentElement || container;
  if (!stage) throw new Error("no player stage");
  stage.querySelectorAll("canvas[data-hevc-player]").forEach((node) => node.remove());
  const canvas = document.createElement("canvas");
  canvas.dataset.hevcPlayer = "1";
  canvas.className = "absolute inset-0 h-full w-full cursor-pointer bg-black";
  canvas.style.zIndex = "1";
  canvas.addEventListener("click", () => video.click());
  canvas.addEventListener("dblclick", () => video.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  stage.appendChild(canvas);
  video.style.visibility = "hidden";
  return canvas;
}

async function attachWasmHevc(
  video: HTMLVideoElement,
  playUrl: string,
  container?: HTMLDivElement | null,
  onPlaying?: () => void,
  preview = false
): Promise<WasmPlayer | null> {
  if (isSmartTvBrowser() || !wasmHevcReady()) return null;
  const Ferrite = await loadFerrite();
  if (!Ferrite?.isSupported()) return null;
  const canvas = mountHevcCanvas(video, container);
  const NativeWorker = window.Worker;
  let presentWorker: Worker | null = null;
  window.Worker = class extends NativeWorker {
    constructor(scriptURL: string | URL, workerOptions?: WorkerOptions) {
      super(scriptURL, workerOptions);
      if (String(scriptURL).includes("present-worker")) presentWorker = this;
    }
  } as typeof Worker;
  try {
    const player = Ferrite.createPlayer(
      { type: "mpegts", isLive: true, url: playUrl, hasAudio: true, hasVideo: true },
      {
        wasmBaseUrl: WASM_BASE,
        workerUrl: `${WASM_BASE}worker.js`,
        presentWorkerUrl: `${WASM_BASE}present-worker.js`,
        audioWorkerUrl: `${WASM_BASE}audio-worker.js`,
        demuxWorkerUrl: `${WASM_BASE}demux-worker.js`,
        preferWebCodecs: true,
        preferSoftwareForHdr: false,
        fastDecode: true,
        threads: preview ? 1 : "auto",
        backgroundAudio: !preview,
        stashAdaptive: false,
        stashInitialSize: preview ? 64 * 1024 : 256 * 1024,
        stashMaxSize: preview ? 256 * 1024 : 1024 * 1024,
        swPresentRingCap: preview ? 2 : 4,
        wcPresentRingCap: preview ? 2 : 6,
        isLive: true,
      }
    );
    let started = false;
    const markPlaying = () => {
      if (started) return;
      started = true;
      onPlaying?.();
    };
    player.on(Ferrite.Events.TIME_UPDATE, markPlaying);
    player.on(Ferrite.Events.MEDIA_INFO, markPlaying);
    player.on(Ferrite.Events.STATISTICS_INFO, (...args: unknown[]) => {
      const info = args[0] as { decodedFrames?: number } | undefined;
      if ((info?.decodedFrames || 0) > 0) markPlaying();
    });
    player.on(Ferrite.Events.ERROR, () => {});
    player.attachCanvas(canvas);
    if (!preview) {
      player.setLevers?.({ present: true, skipNonref: true, skipLoop: true });
    }
    if (!window.crossOriginIsolated) {
      player.destroy();
      throw new Error("not isolated");
    }
    player.volume = video.muted ? 0 : video.volume || 0.9;
    player.muted = video.muted;
    player.grabFrame = () => snapshotPresentWorker(presentWorker);
    player.load();
    await player.play().catch(() => {});
    return player;
  } catch {
    canvas.remove();
    video.style.visibility = "";
    return null;
  } finally {
    window.Worker = NativeWorker;
  }
}

async function attachHls(
  video: HTMLVideoElement,
  url: string,
  lowQuality?: boolean,
  onQualities?: (qualities: QualityOption[]) => void
): Promise<HlsSession | null> {
  const { default: Hls } = await import("hls.js");
  const tv = isSmartTvBrowser();
  if (!Hls.isSupported()) {
    video.src = url;
    video.play().catch(() => {});
    return null;
  }

  const instance = new Hls({
    enableWorker: !tv,
    autoStartLoad: true,
    capLevelToPlayerSize: tv,
    startLevel: lowQuality || tv ? 0 : -1,
    maxBufferLength: lowQuality || tv ? 4 : 30,
    maxMaxBufferLength: lowQuality || tv ? 8 : 60,
    backBufferLength: lowQuality || tv ? 4 : 3600,
    liveSyncDuration: lowQuality || tv ? 3 : 4,
    liveMaxLatencyDuration: lowQuality ? 8 : tv ? 12 : Infinity,
    maxLiveSyncPlaybackRate: lowQuality || tv ? 1 : 1.04,
    manifestLoadingMaxRetry: 6,
    levelLoadingMaxRetry: 6,
    fragLoadingMaxRetry: 8,
  });

  let qualities: QualityOption[] = [{ id: -1, label: "Auto" }];

  instance.on(Hls.Events.MANIFEST_PARSED, () => {
    const next: QualityOption[] = [{ id: -1, label: "Auto" }];
    const seen = new Set<string>();
    (instance.levels || []).forEach((level, index) => {
      if (!level.height) return;
      const label = `${level.height}p`;
      if (seen.has(label)) return;
      seen.add(label);
      next.push({ id: index, label });
    });
    qualities = next;
    onQualities?.(next);
    video.play().catch(() => {});
  });

  instance.on(Hls.Events.ERROR, (_event, data) => {
    if (!data?.fatal) return;
    try {
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) instance.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) instance.recoverMediaError();
    } catch {
      /* ignore */
    }
  });

  instance.loadSource(url);
  instance.attachMedia(video);

  return {
    destroy: () => {
      try {
        instance.destroy();
      } catch {
        /* ignore */
      }
    },
    recover: () => {
      try {
        instance.recoverMediaError();
      } catch {
        /* ignore */
      }
      try {
        instance.startLoad();
      } catch {
        /* ignore */
      }
    },
    getQualities: () => qualities,
    setQuality: (id: number) => {
      try {
        instance.currentLevel = id;
      } catch {
        /* ignore */
      }
    },
    setFollowLive: (on: boolean) => {
      try {
        instance.config.maxLiveSyncPlaybackRate = on && !lowQuality ? 1.04 : 1;
        instance.config.liveSyncDuration = on ? (lowQuality ? 3 : 4) : 3600;
      } catch {
        /* ignore */
      }
    },
  };
}

export async function attachStream(
  video: HTMLVideoElement,
  url: string,
  options: {
    lowQuality?: boolean;
    muted?: boolean;
    engine?: PlayerEngine;
    container?: HTMLDivElement | null;
    onQualities?: (qualities: QualityOption[]) => void;
    onEngine?: (engine: PlayerEngine) => void;
    onPlaying?: () => void;
  } = {}
): Promise<StreamHandle> {
  installQuietErrors();
  if (typeof window === "undefined") {
    return emptyHandle("auto");
  }

  const tv = isSmartTvBrowser();
  prepareTvVideo(video);
  if (options.muted) {
    video.muted = true;
    video.defaultMuted = true;
  }

  const playUrl = proxiedUrl(url);
  let hevcWasm = false;
  if (!tv && isMpegTsUrl(url) && chromeNeedsHevcWasm()) {
    if (options.engine === "wasm") hevcWasm = true;
    else if (options.engine === "mpegts" || options.engine === "mse") hevcWasm = false;
    else {
      const kind = await probeTsVideo(playUrl);
      hevcWasm = kind !== "avc";
    }
  }
  const preferred =
    tv
      ? "native"
      : options.engine && options.engine !== "auto"
        ? hevcWasm && (options.engine === "mpegts" || options.engine === "mse")
          ? "wasm"
          : options.engine
        : hevcWasm
          ? "wasm"
          : bestEngineForUrl(url);
  const fallbacks: PlayerEngine[] = tv
    ? ["native", "hls"]
    : preferred === "hls"
      ? ["hls", "native"]
      : preferred === "wasm"
        ? ["wasm"]
        : preferred === "mpegts" || preferred === "mse"
          ? hevcWasm
            ? ["wasm"]
            : ["mpegts", "mse"]
          : preferred === "native"
            ? ["native", "hls"]
            : [preferred, bestEngineForUrl(url)];

  let destroyed = false;
  const state: {
    hls: HlsSession | null;
    mpeg: MpegPlayer | null;
    wasm: WasmPlayer | null;
    extraDestroy: (() => void) | null;
  } = { hls: null, mpeg: null, wasm: null, extraDestroy: null };
  let used: PlayerEngine = preferred;

  const dropCanvas = () => {
    video.style.visibility = "";
    video.parentElement?.querySelectorAll("canvas[data-hevc-player]").forEach((node) => node.remove());
    options.container?.querySelectorAll("canvas[data-hevc-player]").forEach((node) => node.remove());
  };

  const destroyAll = () => {
    destroyed = true;
    try {
      state.extraDestroy?.();
    } catch {
      /* ignore */
    }
    state.extraDestroy = null;
    try {
      state.wasm?.pause();
      state.wasm?.unload();
      state.wasm?.detachMediaElement();
      state.wasm?.destroy();
    } catch {
      /* ignore */
    }
    state.wasm = null;
    try {
      state.mpeg?.pause();
      state.mpeg?.unload();
      state.mpeg?.detachMediaElement();
      state.mpeg?.destroy();
    } catch {
      /* ignore */
    }
    state.mpeg = null;
    try {
      state.hls?.destroy();
    } catch {
      /* ignore */
    }
    state.hls = null;
    dropCanvas();
    try {
      clearMedia(video);
    } catch {
      /* ignore */
    }
  };

  const tryEngine = async (engine: PlayerEngine) => {
    if (engine === "wasm") {
      if (tv || !isMpegTsUrl(url)) return false;
      state.wasm = await attachWasmHevc(video, playUrl, options.container, options.onPlaying, options.lowQuality);
      used = "wasm";
      return Boolean(state.wasm);
    }
    if (engine === "hls" || engine === "vidstack" || engine === "dash" || engine === "plyr" || engine === "videojs" || engine === "artplayer") {
      if (url.includes(".m3u8") || (tv && isMpegTsUrl(url))) {
        const hlsSrc = isMpegTsUrl(url) ? tvOrTabPlayUrl(url) : url;
        state.hls = await attachHls(video, hlsSrc, options.lowQuality, options.onQualities);
        used = "hls";
        return true;
      }
      if (isMpegTsUrl(url) && hevcWasm) {
        state.wasm = await attachWasmHevc(video, playUrl, options.container, options.onPlaying, options.lowQuality);
        used = "wasm";
        return Boolean(state.wasm);
      }
      if (isMpegTsUrl(url)) {
        state.mpeg = await attachMpegts(video, playUrl, "mpegts", !options.lowQuality);
        used = "mpegts";
        return Boolean(state.mpeg);
      }
    }
    if (engine === "mpegts" || engine === "mse") {
      if (hevcWasm) {
        state.wasm = await attachWasmHevc(video, playUrl, options.container, options.onPlaying, options.lowQuality);
        used = "wasm";
        return Boolean(state.wasm);
      }
      state.mpeg = await attachMpegts(video, playUrl, engine === "mse" ? "mse" : "mpegts", !options.lowQuality);
      used = engine;
      return Boolean(state.mpeg);
    }
    if (engine === "native") {
      if (tv && isMpegTsUrl(url)) {
        let ok = await attachNative(video, tvOrTabPlayUrl(url), "");
        if (!ok) ok = await attachNative(video, viaHlsWrap(url), "");
        used = "native";
        return true;
      }
      const mime = nativeMime(url);
      const primary = url.includes(".m3u8") ? url : playUrl;
      let ok = await attachNative(video, primary, mime);
      if (!ok && primary !== url) {
        ok = await attachNative(video, url, mime);
      }
      used = "native";
      return ok;
    }
    return false;
  };

  try {
    let attached = false;
    for (const engine of fallbacks) {
      if (destroyed) break;
      try {
        attached = await tryEngine(engine);
        if (attached) break;
      } catch {
        attached = false;
      }
    }
    if (!attached && url.includes(".m3u8") && !tv) {
      state.hls = await attachHls(video, url, options.lowQuality, options.onQualities);
      used = "hls";
    }
  } catch {
    /* never throw to the page */
  }

  if (destroyed) destroyAll();
  options.onEngine?.(used);

  const sessionStart = Date.now();
  let followLive = true;

  const rangeEnd = (ranges: TimeRanges | undefined) => {
    if (!ranges || ranges.length === 0) return 0;
    try {
      return ranges.end(ranges.length - 1);
    } catch {
      return 0;
    }
  };

  const rangeStart = (ranges: TimeRanges | undefined) => {
    if (!ranges || ranges.length === 0) return 0;
    try {
      return ranges.start(0);
    } catch {
      return 0;
    }
  };

  const applyFollowLive = (on: boolean) => {
    followLive = on;
    try {
      if (!on) video.playbackRate = 1;
    } catch {
      /* ignore */
    }
    const cfg = mpegtsConfigOf(state.mpeg);
    if (cfg) {
      cfg.liveSync = on;
      cfg.liveBufferLatencyChasing = on;
    }
    state.hls?.setFollowLive(on);
  };

  const readTimeline = (): TimelineState => {
    const elapsed = (Date.now() - sessionStart) / 1000;
    let current = 0;
    let bufferedStart = 0;
    let bufferedEnd = 0;

    if (state.wasm) {
      current = Number(state.wasm.currentTime) || elapsed;
      bufferedEnd = Math.max(current, Number(state.wasm.duration) || elapsed);
      bufferedStart = Math.max(0, bufferedEnd - LIVE_WINDOW_SEC);
    } else {
      current = Number.isFinite(video.currentTime) ? video.currentTime : elapsed;
      bufferedStart = rangeStart(video.buffered) || rangeStart(video.seekable);
      bufferedEnd = rangeEnd(video.buffered) || rangeEnd(video.seekable) || current;
    }

    const live = Math.max(bufferedEnd, current);
    const windowStart = Math.max(0, live - LIVE_WINDOW_SEC, bufferedStart || 0);
    current = Math.min(live, Math.max(windowStart, current));
    return {
      current,
      live,
      windowStart,
      bufferedStart: Math.max(windowStart, bufferedStart || windowStart),
      bufferedEnd: Math.min(live, Math.max(bufferedEnd, current)),
      canSeek: live - windowStart > 1.2,
      followLive: followLive && live - current < 1.6,
    };
  };

  const seekMedia = (target: number) => {
    try {
      if (state.wasm?.seek) {
        state.wasm.seek(target);
        return;
      }
      if (state.mpeg?.seek) {
        state.mpeg.seek(target);
        return;
      }
      video.currentTime = target;
    } catch {
      /* ignore */
    }
  };

  const seekTo = (seconds: number) => {
    const timeline = readTimeline();
    const target = Math.min(timeline.live, Math.max(timeline.windowStart, seconds));
    applyFollowLive(timeline.live - target < 1.6);
    seekMedia(target);
  };

  const goLive = () => {
    const timeline = readTimeline();
    applyFollowLive(true);
    seekMedia(Math.max(timeline.windowStart, timeline.live - 0.8));
  };

  const recoverLive = () => {
    if (destroyed || options.lowQuality || !followLive) return;
    if (tv) {
      video.play().catch(() => {});
      return;
    }
    try {
      if (state.wasm) {
        state.wasm.recover?.();
        state.wasm.play().catch(() => {});
        return;
      }
      if (state.mpeg) {
        state.mpeg.unload();
        state.mpeg.load();
        video.play().catch(() => {});
        return;
      }
      if (state.hls) {
        state.hls.recover();
        video.play().catch(() => {});
        return;
      }
      // Native engine (Samsung TV / no MSE) — must reload the src to escape a stall
      const nativeSrc = url.includes(".m3u8") ? url : playUrl;
      video.src = nativeSrc;
      video.load();
      video.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  if (!options.lowQuality && !tv) {
    let lastBeat = Date.now();
    let cooling = false;
    const beat = () => {
      lastBeat = Date.now();
    };
    video.addEventListener("timeupdate", beat);
    video.addEventListener("playing", beat);
    state.wasm?.on("ferrite_time_update", beat);
    state.wasm?.on("statistics_info", beat);
    const stallTimer = window.setInterval(() => {
      if (destroyed || cooling || !followLive) return;
      if (state.wasm?.paused || (!state.wasm && video.paused)) return;
      const timeline = readTimeline();
      if (timeline.live - timeline.current > 3) return;
      if (Date.now() - lastBeat < 8000) return; // 8 s — fast enough to avoid visible black screen
      cooling = true;
      recoverLive();
      lastBeat = Date.now();
      window.setTimeout(() => {
        cooling = false;
      }, 5000);
    }, 2500);
    const prevDestroy = state.extraDestroy;
    state.extraDestroy = () => {
      prevDestroy?.();
      window.clearInterval(stallTimer);
      video.removeEventListener("timeupdate", beat);
      video.removeEventListener("playing", beat);
    };
  }

  return {
    destroy: destroyAll,
    engine: used,
    usesCanvas: used === "wasm",
    play: () => (state.wasm ? state.wasm.play() : video.play().then(() => undefined).catch(() => undefined)),
    pause: () => {
      if (state.wasm) state.wasm.pause();
      else video.pause();
    },
    setVolume: (value: number) => {
      if (state.wasm) state.wasm.volume = value;
      else video.volume = value;
    },
    setMuted: (muted: boolean) => {
      if (state.wasm) state.wasm.muted = muted;
      else video.muted = muted;
    },
    grabFrame: () => (state.wasm?.grabFrame ? state.wasm.grabFrame() : Promise.resolve(null)),
    getQualities: () => state.hls?.getQualities() || [{ id: -1, label: "Auto" }],
    setQuality: (id: number) => state.hls?.setQuality(id),
    getTimeline: readTimeline,
    seek: seekTo,
    goLive,
  };
}
