"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bug, Check, Copy, ImageOff, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Channel } from "@/data/channels";
import { ChannelLogo } from "./ChannelLogo";
import { StreamThumb } from "./StreamThumb";
import { resolveStreamUrl } from "@/lib/streamResolver";
import { attachStream, type StreamHandle } from "@/lib/attachStream";

interface StreamCardProps {
  channel: Channel;
  isActive: boolean;
  thumbnail?: string;
  capturing?: boolean;
  hasVideo?: boolean;
  hasAudio?: boolean;
  statusKnown?: boolean;
  stillVersion?: number;
  onSelect: (channel: Channel) => void;
  onRefreshThumbnail: (channel: Channel) => Promise<void>;
}

export function StreamCard({
  channel,
  isActive,
  thumbnail,
  capturing,
  hasVideo,
  hasAudio,
  statusKnown,
  stillVersion,
  onSelect,
  onRefreshThumbnail,
}: StreamCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<StreamHandle | null>(null);
  const [hovering, setHovering] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const keepLive = (hovering || soundOn) && channel.type === "Static" && channel.streamUrl.includes(".m3u8");

  useEffect(() => {
    const video = videoRef.current;
    if (!keepLive) {
      handleRef.current?.destroy();
      handleRef.current = null;
      if (video) {
        video.pause();
        video.removeAttribute("src");
      }
      setPreviewReady(false);
      return;
    }

    let cancelled = false;
    const showFrame = () => {
      if (!cancelled && video && video.videoWidth > 2) {
        setPreviewReady(true);
      }
    };

    const load = async () => {
      if (!video) return;
      video.muted = !soundOn;
      video.volume = soundOn ? 0.9 : 0;
      video.addEventListener("loadeddata", showFrame);
      video.addEventListener("playing", showFrame);

      try {
        const url = await resolveStreamUrl(channel);
        if (cancelled) return;
        handleRef.current = await attachStream(video, url, { lowQuality: true, muted: !soundOn });
      } catch {
        /* ignore */
      }
    };

    load();
    return () => {
      cancelled = true;
      video?.removeEventListener("loadeddata", showFrame);
      video?.removeEventListener("playing", showFrame);
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [keepLive, channel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !soundOn;
    video.volume = soundOn ? 0.9 : 0;
  }, [soundOn]);

  const copyStreamUrl = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const url = await resolveStreamUrl(channel);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const dumpChannel = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (channel.sourceRaw) {
      console.log(channel.sourceRaw);
      return;
    }
    console.log({
      name: channel.name,
      type: channel.type,
      baseUrl: channel.baseUrl,
      streamUrl: channel.streamUrl,
    });
  };

  const refreshThumb = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefreshThumbnail(channel);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(channel)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(channel);
        }
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`card-glow group w-full cursor-pointer overflow-hidden rounded-2xl bg-zinc-900 text-left ${
        isActive ? "ring-1 ring-white/30" : ""
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <StreamThumb channel={channel} dataUrl={thumbnail} stillVersion={stillVersion} />
        <video
          ref={videoRef}
          muted={!soundOn}
          playsInline
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${
            previewReady ? "opacity-100" : "opacity-0"
          }`}
        />

        <div className="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Live
        </div>

        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          {statusKnown && !capturing && !thumbnail && !hasVideo && (
            <span
              title="No video image"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-red-500 opacity-70"
            >
              <ImageOff className="h-3.5 w-3.5" />
            </span>
          )}
          {statusKnown && !capturing && !thumbnail && !hasAudio && (
            <span
              title="No sound"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-red-400 opacity-70"
            >
              <VolumeX className="h-3.5 w-3.5" />
            </span>
          )}
          <button
            type="button"
            title="Log channel data"
            onClick={dumpChannel}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/70 text-zinc-200 hover:bg-black/90"
          >
            <Bug className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Refresh thumbnail"
            onClick={refreshThumb}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/70 text-zinc-200 hover:bg-black/90"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1">
          <button
            type="button"
            title={copied ? "Copied" : "Copy stream URL"}
            onClick={copyStreamUrl}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-black/70 text-zinc-100 hover:bg-black/90"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            title={soundOn ? "Mute this stream" : "Play sound"}
            onClick={(event) => {
              event.stopPropagation();
              setSoundOn((on) => !on);
            }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-black/70 text-zinc-100 hover:bg-black/90"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        {isActive && (
          <div className="absolute bottom-2 left-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-900">
            Now playing
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 p-3">
        <ChannelLogo channel={channel} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{channel.displayName}</p>
          <p className="truncate text-xs text-zinc-400">{channel.currentShow}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{channel.category}</p>
        </div>
      </div>
    </div>
  );
}
