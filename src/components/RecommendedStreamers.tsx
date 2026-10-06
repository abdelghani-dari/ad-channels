"use client";

import React from "react";
import { Channel } from "@/data/channels";
import { ChannelLogo } from "./ChannelLogo";

type PlaylistId = "maroc" | "bein";

interface RecommendedStreamersProps {
  playlist: PlaylistId;
  onPlaylistChange: (playlist: PlaylistId) => void;
  channels: Channel[];
  activeChannel: Channel;
  onSelectChannel: (channel: Channel) => void;
}

export function RecommendedStreamers({
  playlist,
  onPlaylistChange,
  channels,
  activeChannel,
  onSelectChannel,
}: RecommendedStreamersProps) {
  return (
    <div className="card-glow w-full overflow-hidden rounded-2xl bg-zinc-900 p-3">
      <h3 className="mb-3 px-1 text-sm font-semibold text-white">Playlists</h3>
      <div className="mb-3 flex flex-row gap-2">
        <button
          type="button"
          onClick={() => onPlaylistChange("maroc")}
          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2 py-2 ${
            playlist === "maroc" ? "bg-white text-zinc-900" : "bg-zinc-800/70 text-white hover:bg-zinc-800"
          }`}
        >
          <img src="/images/logos/maroc.png" alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
          <span className="truncate text-sm font-semibold">Maroc</span>
        </button>
        <button
          type="button"
          onClick={() => onPlaylistChange("bein")}
          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2 py-2 ${
            playlist === "bein" ? "bg-white text-zinc-900" : "bg-zinc-800/70 text-white hover:bg-zinc-800"
          }`}
        >
          <img
            src="/images/logos/beinsport.svg"
            alt=""
            className="h-8 w-8 shrink-0 rounded-md bg-black object-contain p-0.5"
          />
          <span className="truncate text-sm font-semibold">beIN</span>
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] text-zinc-400">{playlist === "maroc" ? "Morocco live" : "beIN feeds"}</span>
        <span className="text-[11px] text-zinc-500">{channels.length}</span>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-white/5">
        {channels.map((ch, index) => {
          const isCurrent = ch.id === activeChannel.id;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSelectChannel(ch)}
              className={`flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left ${
                isCurrent ? "bg-white/10" : "bg-white/[0.03] hover:bg-white/[0.07]"
              } ${index !== 0 ? "border-t border-white/10" : ""}`}
            >
              <ChannelLogo channel={ch} size="sm" plain />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-zinc-100">{ch.displayName}</p>
                <p className="truncate text-[11px] text-zinc-400">{ch.currentShow}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
