let cached: boolean | null = null;

export function isSmartTvBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (cached !== null) return cached;
  const ua = `${navigator.userAgent} ${navigator.vendor || ""}`;
  cached = /Tizen|SMART-TV|SmartTV|Smart[ \-]TV|Maple|Web0S|webOS|NetCast|HbbTV|VIDAA|BRAVIA/i.test(ua);
  if (cached) markTvDocument();
  return cached;
}

export function nativeHlsSupported(video?: HTMLVideoElement | null): boolean {
  if (typeof document === "undefined") return false;
  const el = video || document.createElement("video");
  return (
    el.canPlayType("application/vnd.apple.mpegurl") !== "" ||
    el.canPlayType("application/x-mpegURL") !== "" ||
    el.canPlayType("audio/mpegurl") !== ""
  );
}

export function nativeMpegTsSupported(video?: HTMLVideoElement | null): boolean {
  if (typeof document === "undefined") return false;
  const el = video || document.createElement("video");
  return (
    el.canPlayType("video/mp2t") !== "" ||
    el.canPlayType("video/MP2T") !== "" ||
    el.canPlayType("video/vnd.dlna.mpeg-tts") !== ""
  );
}

/** Tizen/webOS: use the TV hardware player, never MSE/WASM. */
export function preferNativeVideo(video?: HTMLVideoElement | null): boolean {
  if (isSmartTvBrowser()) return true;
  if (typeof window === "undefined") return false;
  try {
    if (typeof window.MediaSource === "undefined" && typeof (window as Window & { WebKitMediaSource?: unknown }).WebKitMediaSource === "undefined") {
      return true;
    }
  } catch {
    return true;
  }
  return nativeHlsSupported(video);
}

export function markTvDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("tv-browser");
}

export function prepareTvVideo(video: HTMLVideoElement): void {
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x5-playsinline", "true");
  video.disableRemotePlayback = false;
  try {
    video.removeAttribute("crossorigin");
  } catch {
    /* ignore */
  }
}
