"use client";

import React, { useState } from "react";
import { X, Volume2, VolumeX, Check } from "lucide-react";
import { Channel } from "@/data/channels";
import { ChannelLogo } from "./ChannelLogo";
import { resolveStreamUrl } from "@/lib/streamResolver";
import { attachStream, type StreamHandle } from "@/lib/attachStream";

interface MultiviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
}

function MiniPlayer({ channel }: { channel: Channel }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
    const handleRef = React.useRef<StreamHandle | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  React.useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        const streamUrl = await resolveStreamUrl(channel);
        const video = videoRef.current;
        if (isCancelled || !video) return;
        video.muted = true;
        video.playsInline = true;
        handleRef.current = await attachStream(video, streamUrl, { lowQuality: true, muted: true });
      } catch {
        /* ignore */
      }
    };

    load();

    return () => {
      isCancelled = true;
      handleRef.current?.destroy();
    };
  }, [channel]);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-black">
      <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
      <div className="absolute left-2 top-2 flex items-center gap-2 rounded-md bg-black/70 px-2 py-1">
        <ChannelLogo channel={channel} size="sm" />
        <span className="max-w-[140px] truncate text-xs font-medium text-white">{channel.displayName}</span>
      </div>
      <button
        onClick={() => {
          if (!videoRef.current) return;
          const next = !isMuted;
          videoRef.current.muted = next;
          setIsMuted(next);
        }}
        className="absolute bottom-2 right-2 rounded-md bg-black/70 p-1.5 text-white"
      >
        {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function MultiviewModal({ isOpen, onClose, channels }: MultiviewModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    channels[0]?.id || "2m",
    channels[1]?.id || "arryadia",
    channels[2]?.id || "al-aoula",
    channels[3]?.id || "arryadia-hd1",
  ]);

  if (!isOpen) return null;

  const activeChannels = channels.filter((c) => selectedIds.includes(c.id));

  const toggleChannel = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter((i) => i !== id));
      }
    } else if (selectedIds.length < 4) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">Multiview</h2>
            <p className="text-xs text-zinc-400">Watch up to 4 channels</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-800 px-4 py-3">
          {channels.map((ch) => {
            const isSelected = selectedIds.includes(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => toggleChannel(ch.id)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  isSelected ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {isSelected && <Check className="h-3 w-3" />}
                {ch.displayName}
              </button>
            );
          })}
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          {activeChannels.map((channel) => (
            <MiniPlayer key={channel.id} channel={channel} />
          ))}
        </div>
      </div>
    </div>
  );
}
