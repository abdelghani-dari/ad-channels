export function isXtreamTsUrl(url: string): boolean {
  return url.includes("/live.php") || /extension=ts/i.test(url);
}

export function asXtreamHls(url: string): string {
  if (/extension=m3u8/i.test(url)) return url;
  if (/extension=ts/i.test(url)) return url.replace(/extension=ts/gi, "extension=m3u8");
  if (url.includes("/live.php") && !url.includes("extension=")) {
    return `${url}${url.includes("?") ? "&" : "?"}extension=m3u8`;
  }
  return url;
}

function originPrefix(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function viaMediaProxy(url: string): string {
  return `${originPrefix()}/api/media-proxy?url=${encodeURIComponent(url)}`;
}

export function viaHlsWrap(url: string): string {
  return `${originPrefix()}/api/hls-live?url=${encodeURIComponent(url)}`;
}

/** HTTPS HLS URL the TV native player can load, same idea as Maroc .m3u8. */
export function tvOrTabPlayUrl(url: string): string {
  if (!isXtreamTsUrl(url) && !/extension=m3u8/i.test(url)) return url;
  return viaMediaProxy(asXtreamHls(url));
}
