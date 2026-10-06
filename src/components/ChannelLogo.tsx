"use client";

import React, { useState } from "react";
import { Channel } from "@/data/channels";
import { cn } from "@/lib/utils";

interface ChannelLogoProps {
  channel: Channel;
  size?: "sm" | "md" | "lg";
  className?: string;
  plain?: boolean;
}

const sizeMap = {
  sm: "w-7 h-7",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

export function ChannelLogo({ channel, size = "md", className = "", plain = false }: ChannelLogoProps) {
  const [failed, setFailed] = useState(false);
  const box = cn(
    sizeMap[size],
    "overflow-hidden flex items-center justify-center flex-shrink-0",
    plain ? "rounded-md bg-transparent" : "rounded-lg bg-zinc-800",
    className
  );

  if (channel.logoUrl && !failed) {
    return (
      <img
        src={channel.logoUrl}
        alt={channel.displayName}
        className={cn(box, "object-contain", plain ? "bg-transparent" : "bg-black")}
        onError={() => setFailed(true)}
      />
    );
  }

  if (channel.id.startsWith("bein-")) {
    return (
      <img
        src="/images/logos/beinsport.svg"
        alt={channel.displayName}
        className={cn(box, "object-contain", plain ? "bg-transparent" : "bg-black")}
      />
    );
  }

  return (
    <img
      src="/images/logos/maroc.png"
      alt={channel.displayName}
      className={cn(box, "object-contain", plain ? "bg-transparent" : "bg-black")}
    />
  );
}
