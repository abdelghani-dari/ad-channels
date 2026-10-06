export interface LiveHlsOptions {
  lowQuality?: boolean;
}

export function canUseNativeHls(video: HTMLVideoElement): boolean {
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}
