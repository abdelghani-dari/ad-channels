"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RefreshCw,
  MonitorPlay,
  PictureInPicture2,
  Settings2,
} from "lucide-react";
import { Channel } from "@/data/channels";
import { resolveStreamUrl } from "@/lib/streamResolver";
import {
  attachStream,
  enginesForUrl,
  type PlayerEngine,
  type QualityOption,
  type StreamHandle,
} from "@/lib/attachStream";
import { captureFromVideo } from "@/lib/captureThumbnails";
import { ChannelLogo } from "./ChannelLogo";

interface MainHeroPlayerProps {
  channel: Channel;
  onOpenMultiview?: () => void;
  onThumb?: (channelId: string, dataUrl: string) => void;
}



export function MainHeroPlayer({ channel, onOpenMultiview, onThumb }: MainHeroPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const streamHandleRef = useRef<StreamHandle | null>(null);
  const clickTimerRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPicture, setHasPicture] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [playerEngine, setPlayerEngine] = useState<PlayerEngine>("auto");
  const [resolvedEngine, setResolvedEngine] = useState<PlayerEngine>("hls");
  const [playerMenuOpen, setPlayerMenuOpen] = useState(false);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [qualities, setQualities] = useState<QualityOption[]>([{ id: -1, label: "Auto" }]);
  const [qualityId, setQualityId] = useState(-1);
  const [isMini, setIsMini] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const hideChromeTimerRef = useRef(0);
  const inBottomZoneRef = useRef(false);

  const getVideo = () =>
    videoRef.current ?? containerRef.current?.querySelector("video") ?? null;

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setHasError(false);
    setHasPicture(false);
    setQualities([{ id: -1, label: "Auto" }]);
    setQualityId(-1);
    setNeedsGesture(false);

    const initStream = async () => {
      try {
        const streamUrl = await resolveStreamUrl(channel);
        if (isCancelled) return;

        const video = videoRef.current;
        if (!video) return;

        video.volume = volume;
        video.muted = false;
        video.playsInline = true;

        try {
          streamHandleRef.current?.destroy();
        } catch {
          /* ignore */
        }
        streamHandleRef.current = null;

        const startPlayback = () => {
          if (isCancelled || !videoRef.current) return;
          setIsLoading(false);
          setHasError(false);
          setHasPicture(true);
          const el = videoRef.current;
          if (el.style.visibility === "hidden" || streamHandleRef.current?.usesCanvas) {
            setIsPlaying(true);
            setNeedsGesture(false);
            return;
          }
          el.volume = volume;
          el
            .play()
            .then(() => {
              setIsPlaying(true);
              setIsMuted(el.muted);
              setNeedsGesture(el.muted);
            })
            .catch(() => {
              el.muted = true;
              setIsMuted(true);
              setNeedsGesture(true);
              el.play()
                .then(() => setIsPlaying(true))
                .catch(() => {
                  setIsLoading(false);
                  setNeedsGesture(true);
                });
            });
        };

        video.addEventListener("playing", startPlayback);
        video.addEventListener("loadeddata", startPlayback);
        streamHandleRef.current = await attachStream(video, streamUrl, {
          engine: playerEngine,
          container: containerRef.current,
          onQualities: setQualities,
          onEngine: setResolvedEngine,
          onPlaying: startPlayback,
        });
        video.addEventListener("error", () => {
          if (!isCancelled) setIsLoading(false);
        });
      } catch {
        if (!isCancelled) setIsLoading(false);
      }
    };

    initStream();

    return () => {
      isCancelled = true;
      streamHandleRef.current?.destroy();
      streamHandleRef.current = null;
    };
  }, [channel, playerEngine]);

  useEffect(() => {
    const handle = streamHandleRef.current;
    if (handle?.usesCanvas) {
      handle.setVolume?.(isMuted ? 0 : volume);
      handle.setMuted?.(isMuted);
      return;
    }
    const video = getVideo();
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const on = !!document.fullscreenElement;
      setIsFullscreen(on);
      setShowChrome(true);
      inBottomZoneRef.current = false;
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    window.clearTimeout(hideChromeTimerRef.current);
    if (!isFullscreen) {
      setShowChrome(true);
      return;
    }
    if (playerMenuOpen || qualityMenuOpen || inBottomZoneRef.current) {
      setShowChrome(true);
      return;
    }
    hideChromeTimerRef.current = window.setTimeout(() => setShowChrome(false), 1600);
    return () => window.clearTimeout(hideChromeTimerRef.current);
  }, [isFullscreen, playerMenuOpen, qualityMenuOpen]);

  useEffect(() => {
    if (showChrome) return;
    setPlayerMenuOpen(false);
    setQualityMenuOpen(false);
  }, [showChrome]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const root = sentinel.closest("main");
    const observer = new IntersectionObserver(
      ([entry]) => setIsMini(!entry.isIntersecting),
      { root, threshold: 0.2, rootMargin: "0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = getVideo();
    if (!video || !onThumb) return;
    let done = false;
    const tick = () => {
      if (done) return;
      const frame = captureFromVideo(channel.id, video);
      if (frame) {
        onThumb(channel.id, frame);
        done = true;
      }
    };
    const interval = window.setInterval(tick, 1200);
    video.addEventListener("playing", tick);
    return () => {
      window.clearInterval(interval);
      video.removeEventListener("playing", tick);
    };
  }, [channel.id, playerEngine, onThumb]);

  // Watchdog: poll every 5 s; if video is stuck (readyState < 3 while not paused)
  // for 15 consecutive seconds after first picture, trigger a full stream reload.
  // Poll-based is safer than events — 'waiting'/'emptied' fire during normal buffering.
  useEffect(() => {
    let stuckMs = 0;
    const POLL_MS = 5000;
    const MAX_STUCK_MS = 15000;

    const timer = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused) { stuckMs = 0; return; }
      if (!hasPicture) { stuckMs = 0; return; } // still loading first frame
      if (v.readyState >= 3) { stuckMs = 0; return; } // playing fine
      stuckMs += POLL_MS;
      if (stuckMs >= MAX_STUCK_MS) {
        stuckMs = 0;
        reloadStream().catch(() => {});
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, playerEngine, hasPicture]);

  const enableSound = () => {
    const handle = streamHandleRef.current;
    if (handle?.usesCanvas) {
      handle.setMuted?.(false);
      handle.setVolume?.(volume || 0.9);
      setIsMuted(false);
      setNeedsGesture(false);
      handle.play?.().then(() => setIsPlaying(true)).catch(() => {});
      return;
    }
    const video = getVideo();
    if (!video) return;
    video.muted = false;
    video.volume = volume || 0.9;
    setIsMuted(false);
    setNeedsGesture(false);
    video.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* fullscreen not supported (e.g. Samsung TV browser) */
    }
  };

  const togglePlay = () => {
    const handle = streamHandleRef.current;
    if (handle?.usesCanvas) {
      if (isPlaying) {
        handle.pause?.();
        setIsPlaying(false);
      } else {
        handle.play?.().then(() => setIsPlaying(true)).catch(() => {});
      }
      return;
    }
    const video = getVideo();
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const onVideoClick = () => {
    window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => togglePlay(), 220);
  };

  const onVideoDoubleClick = () => {
    window.clearTimeout(clickTimerRef.current);
    toggleFullscreen();
  };

  const togglePip = async () => {
    const video = getVideo();
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* ignore — not supported on this browser */
    }
  };

  const applyQuality = (id: number) => {
    setQualityId(id);
    streamHandleRef.current?.setQuality(id);
    setQualityMenuOpen(false);
  };

  const onPlayerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isFullscreen) return;
    const fromBottom = event.currentTarget.getBoundingClientRect().bottom - event.clientY;
    inBottomZoneRef.current = fromBottom <= 64;
    if (inBottomZoneRef.current || playerMenuOpen || qualityMenuOpen) {
      window.clearTimeout(hideChromeTimerRef.current);
      setShowChrome(true);
      return;
    }
    window.clearTimeout(hideChromeTimerRef.current);
    hideChromeTimerRef.current = window.setTimeout(() => {
      if (!inBottomZoneRef.current) setShowChrome(false);
    }, 1600);
  };

  const onPlayerPointerLeave = () => {
    if (!isFullscreen) return;
    inBottomZoneRef.current = false;
    if (playerMenuOpen || qualityMenuOpen) return;
    window.clearTimeout(hideChromeTimerRef.current);
    hideChromeTimerRef.current = window.setTimeout(() => setShowChrome(false), 1200);
  };

  const reloadStream = async () => {
    setIsLoading(true);
    setHasError(false);
    const streamUrl = await resolveStreamUrl(channel);
    const video = videoRef.current;
    if (!video) return;
    try {
      streamHandleRef.current?.destroy();
    } catch {
      /* ignore */
    }
    streamHandleRef.current = await attachStream(video, streamUrl, {
      engine: playerEngine,
      container: containerRef.current,
      onQualities: setQualities,
      onEngine: setResolvedEngine,
      onPlaying: () => {
        setIsLoading(false);
        setHasPicture(true);
      },
    });
  };

  return (
    <div ref={sentinelRef} className={isMini ? "aspect-video w-full" : "w-full"}>
    <div
      ref={containerRef}
      tabIndex={0}
      onPointerMove={onPlayerPointerMove}
      onPointerLeave={onPlayerPointerLeave}
      className={
        isMini
          ? "fixed bottom-4 right-4 z-50 w-[280px] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl outline-none md:w-[320px]"
          : isFullscreen
            ? `relative h-full w-full overflow-hidden bg-black outline-none ${showChrome ? "" : "cursor-none"}`
            : "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black outline-none"
      }
    >
      <div className={isFullscreen ? "relative h-full w-full" : "relative aspect-video w-full"}>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className="h-full w-full cursor-pointer bg-black object-contain"
          onPlaying={() => setIsLoading(false)}
          onLoadedData={() => setIsLoading(false)}
          onClick={onVideoClick}
          onDoubleClick={onVideoDoubleClick}
          onError={() => {
            const code = videoRef.current?.error?.code;
            if (code === 1) return;
            setIsLoading(false);
          }}
        />

        {isLoading && showChrome && (
          <div className="pointer-events-none absolute bottom-24 left-3 z-20 md:bottom-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-medium text-zinc-200 shadow-lg">
              <span className="h-3 w-3 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
              {hasPicture ? "Reconnecting" : "Connecting"}
            </span>
          </div>
        )}

        {needsGesture && !hasError && (
          <button
            onClick={enableSound}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/40"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900">
              <Volume2 className="h-4 w-4" />
              Enable sound
            </span>
          </button>
        )}

        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4 transition-opacity duration-300 ${
            showChrome ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {channel.id !== "2m" && <ChannelLogo channel={channel} size="md" />}
            <div>
              <h2 className="text-base font-semibold text-white md:text-lg">{channel.displayName}</h2>
              <p className="text-xs text-zinc-300">{channel.currentShow}</p>
            </div>
          </div>
        </div>

        {isFullscreen && !showChrome ? <div className="absolute inset-x-0 bottom-0 z-40 h-16" /> : null}

        <div
          className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/85 to-transparent p-3 transition-opacity duration-300 md:p-4 ${
            showChrome ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? "Pause" : "Play"}
              </button>

            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1">
                <button
                  onClick={() => {
                    if (isMuted) {
                      enableSound();
                    } else {
                      setIsMuted(true);
                    }
                  }}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-red-400" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-zinc-100" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (val > 0) {
                      setIsMuted(false);
                      setNeedsGesture(false);
                    }
                  }}
                  className="h-1 w-16 cursor-pointer accent-zinc-100"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => {
                    setQualityMenuOpen((open) => !open);
                    setPlayerMenuOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-[11px] font-medium text-zinc-100"
                  title="Quality"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {qualities.find((item) => item.id === qualityId)?.label ?? "Auto"}
                </button>
                {qualityMenuOpen && (
                  <div className="absolute bottom-10 right-0 z-30 min-w-28 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                    {qualities.map((option) => (
                      <button
                        key={`${option.id}-${option.label}`}
                        type="button"
                        onClick={() => applyQuality(option.id)}
                        className={`block w-full cursor-pointer px-3 py-1.5 text-left text-xs ${
                          qualityId === option.id ? "bg-white text-zinc-900" : "text-zinc-200 hover:bg-zinc-800"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => {
                    setPlayerMenuOpen((open) => !open);
                    setQualityMenuOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-[11px] font-medium text-zinc-100"
                  title="Switch player"
                >
                  <MonitorPlay className="h-3.5 w-3.5" />
                  {playerEngine === "auto"
                    ? `Auto · ${enginesForUrl(channel.streamUrl).find((option) => option.id === resolvedEngine)?.label ?? "HLS.js"}`
                    : enginesForUrl(channel.streamUrl).find((option) => option.id === playerEngine)?.label ?? "Auto"}
                </button>
                {playerMenuOpen && (
                  <div className="absolute bottom-10 right-0 z-30 min-w-32 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                    {enginesForUrl(channel.streamUrl).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setPlayerEngine(option.id);
                          setPlayerMenuOpen(false);
                        }}
                        className={`block w-full cursor-pointer px-3 py-1.5 text-left text-xs ${
                          playerEngine === option.id ? "bg-white text-zinc-900" : "text-zinc-200 hover:bg-zinc-800"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={reloadStream}
                className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-1.5 text-zinc-200"
                title="Refresh stream"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={togglePip}
                className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-1.5 text-zinc-200"
                title="Picture in picture"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-1.5 text-zinc-200"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
