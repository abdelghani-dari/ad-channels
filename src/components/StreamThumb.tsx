"use client";

import React, { useEffect, useState } from "react";
import { Channel } from "@/data/channels";
import { getThumbnailStill } from "@/lib/captureThumbnails";

function playlistFallback(channel: Channel): string {
  return channel.id.startsWith("bein-") ? "/images/logos/beinsport.svg" : "/images/logos/maroc.png";
}

function SafeImg({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className: string;
  fallback: string;
}) {
  const [current, setCurrent] = useState(src);

  useEffect(() => {
    setCurrent(src);
  }, [src]);

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}

export function StreamThumb({
  channel,
  dataUrl,
  stillVersion = 0,
  className = "",
}: {
  channel: Channel;
  dataUrl?: string;
  stillVersion?: number;
  className?: string;
}) {
  const usableDataUrl = dataUrl?.startsWith("data:") ? dataUrl : undefined;
  const still = typeof window !== "undefined" ? getThumbnailStill(channel.id) : undefined;

  const fallback = playlistFallback(channel);

  if (usableDataUrl) {
    return <SafeImg src={usableDataUrl} alt="" fallback={fallback} className={`h-full w-full object-cover ${className}`} />;
  }

  if (still) {
    return (
      <canvas
        ref={(node) => {
          if (!node) return;
          node.width = still.width;
          node.height = still.height;
          node.getContext("2d")?.drawImage(still, 0, 0);
        }}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const src = channel.logoUrl || fallback;
  return (
    <div className={`flex h-full w-full items-center justify-center bg-zinc-950 ${className}`}>
      <SafeImg src={src} alt={channel.displayName} fallback={fallback} className="h-2/3 w-2/3 object-contain" />
      <span className="sr-only">{stillVersion}</span>
    </div>
  );
}
