"use client";

import React, { useEffect, useRef } from "react";
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from "@vidstack/react";
import "@vidstack/react/player/styles/base.css";
import { Channel } from "@/data/channels";
import { resolveStreamUrl } from "@/lib/streamResolver";
import { attachStream, isMpegTsUrl, type StreamHandle } from "@/lib/attachStream";

function videoFromPlayer(player: MediaPlayerInstance | null): HTMLVideoElement | null {
  const inst = player as MediaPlayerInstance & { el?: HTMLElement };
  return (inst?.el?.querySelector("video") ?? null) as HTMLVideoElement | null;
}

export function VidstackSurface({
  channel,
  muted,
  volume,
  onReady,
}: {
  channel: Channel;
  muted: boolean;
  volume: number;
  onReady: () => void;
}) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const handleRef = useRef<StreamHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const playback = channel.baseUrl ? { ...channel, streamUrl: channel.baseUrl } : channel;
      const url = await resolveStreamUrl(playback);
      if (cancelled) return;
      let video: HTMLVideoElement | null = null;
      for (let i = 0; i < 25; i += 1) {
        video = videoFromPlayer(playerRef.current);
        if (video) break;
        await new Promise((r) => setTimeout(r, 40));
      }
      if (cancelled || !video) return;
      video.muted = muted;
      video.volume = volume;
      handleRef.current?.destroy();
      handleRef.current = await attachStream(video, url, {
        engine: isMpegTsUrl(url) ? "mpegts" : "hls",
        muted,
      });
      onReady();
    })();
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [channel]);

  useEffect(() => {
    const inst = playerRef.current as (MediaPlayerInstance & { muted?: boolean; volume?: number }) | null;
    const video = videoFromPlayer(playerRef.current);
    if (inst) {
      inst.muted = muted;
      inst.volume = volume;
    }
    if (video) {
      video.muted = muted;
      video.volume = volume;
    }
  }, [muted, volume]);

  return (
    <MediaPlayer
      ref={playerRef}
      className="h-full w-full bg-black"
      title={channel.displayName}
      src={undefined}
      autoPlay
      playsInline
      streamType="live"
      muted={muted}
      volume={volume}
      onCanPlay={() => onReady()}
    >
      <MediaProvider />
    </MediaPlayer>
  );
}
