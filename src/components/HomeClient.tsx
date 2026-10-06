"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { CHANNELS, Channel } from "@/data/channels";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { MainHeroPlayer } from "@/components/MainHeroPlayer";
import { StreamCard } from "@/components/StreamCard";
import { RecommendedStreamers } from "@/components/RecommendedStreamers";
import { MultiviewModal } from "@/components/MultiviewModal";
import { captureOneWithRetry, runThumbQueue, type CaptureResult } from "@/lib/captureThumbnails";
import { loadBeinChannels, fetchBeinPlaylistRaw } from "@/lib/parseM3u";

export function HomeClient() {
  const [playlist, setPlaylist] = useState<"maroc" | "bein">("maroc");
  const [beinChannels, setBeinChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel>(CHANNELS[0]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMultiviewOpen, setIsMultiviewOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("browse");
  const [savedChannelIds] = useState<string[]>(["2m", "arryadia"]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [streamHealth, setStreamHealth] = useState<Record<string, { hasVideo: boolean; hasAudio: boolean }>>({});
  const [capturingIds, setCapturingIds] = useState<Record<string, boolean>>({});
  const [thumbFilter, setThumbFilter] = useState<"all" | "image" | "broken">("all");
  const [nameFilter, setNameFilter] = useState("all");
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [stillVersion, setStillVersion] = useState(0);

  const playlistChannels = playlist === "maroc" ? CHANNELS : beinChannels;
  const queueAbortRef = useRef<AbortController | null>(null);
  const queueBusyRef = useRef(false);
  const beinRawRef = useRef<{ path: string; ok: boolean; text: string }[]>([]);
  const activeIdRef = useRef(activeChannel.id);
  activeIdRef.current = activeChannel.id;

  const applyResult = (channelId: string, result: CaptureResult) => {
    if (result.frame) {
      setThumbnails((prev) => (prev[channelId] === result.frame ? prev : { ...prev, [channelId]: result.frame as string }));
      setStillVersion((value) => value + 1);
    }
    setStreamHealth((prev) => ({
      ...prev,
      [channelId]: {
        hasVideo: Boolean(result.frame) || result.hasVideo,
        hasAudio: Boolean(result.frame) || result.hasAudio,
      },
    }));
    setCapturingIds((prev) => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
  };

  const refreshThumbnail = async (channel: Channel, signal?: AbortSignal) => {
    const local = signal ?? new AbortController().signal;
    const result = await captureOneWithRetry(channel, local, true, 3);
    if (local.aborted) return;
    applyResult(channel.id, result);
  };

  const refreshAllLikeClicks = (list: Channel[]) => {
    if (list.length === 0) return;
    queueAbortRef.current?.abort();
    const controller = new AbortController();
    queueAbortRef.current = controller;
    queueBusyRef.current = true;
    setRefreshingAll(true);
    void runThumbQueue(
      list,
      {
        onCaptured: applyResult,
        onDone: () => {
          if (queueAbortRef.current === controller) {
            queueBusyRef.current = false;
            setRefreshingAll(false);
          }
        },
      },
      controller.signal,
      { force: true, getSkipId: () => activeIdRef.current }
    );
  };

  useEffect(() => {
    loadBeinChannels().then(setBeinChannels).catch(() => setBeinChannels([]));
    fetchBeinPlaylistRaw().then((raw) => {
      beinRawRef.current = raw;
    }).catch(() => {
      beinRawRef.current = [];
    });
  }, []);

  useEffect(() => {
    setNameFilter("all");
    queueAbortRef.current?.abort();
    setCapturingIds({});
    setRefreshingAll(false);
  }, [playlist]);

  useEffect(() => {
    if (playlist !== "maroc") return;
    if (!CHANNELS.some((ch) => ch.id === activeChannel.id)) {
      setActiveChannel(CHANNELS[0]);
    }
    refreshAllLikeClicks(CHANNELS);
    return () => queueAbortRef.current?.abort();
  }, [playlist]);

  useEffect(() => {
    if (playlist !== "bein" || beinChannels.length === 0) return;
    if (!beinChannels.some((ch) => ch.id === activeChannel.id)) {
      setActiveChannel(beinChannels[0]);
    }
    refreshAllLikeClicks(beinChannels);
    return () => queueAbortRef.current?.abort();
  }, [playlist, beinChannels.length]);

  useEffect(() => {
    const onPageHide = () => queueAbortRef.current?.abort();
    window.addEventListener("pagehide", onPageHide);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (queueBusyRef.current) return;
      const list = playlist === "maroc" ? CHANNELS : beinChannels;
      if (playlist === "bein") return;
      if (list.length === 0) return;
      refreshAllLikeClicks(list);
    }, 120000);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(timer);
    };
  }, [playlist, beinChannels.length]);

  const refreshAllThumbnails = () => {
    refreshAllLikeClicks(playlistChannels);
  };

  const filteredChannels = useMemo(() => {
    return playlistChannels.filter((ch) => {
      if (activeNav === "saved" && !savedChannelIds.includes(ch.id)) return false;
      const label = `${ch.name} ${ch.displayName}`.toLowerCase();
      if (nameFilter !== "all") {
        if (playlist === "maroc") {
          if (nameFilter === "arryadia" && !label.includes("arryadia")) return false;
          if (nameFilter === "2m" && !label.includes("2m")) return false;
          if (nameFilter === "alaoula" && !label.includes("aoula")) return false;
          if (nameFilter === "others" && (label.includes("arryadia") || label.includes("2m") || label.includes("aoula"))) {
            return false;
          }
        } else {
          const hdNum = label.match(/hd\s*(\d+)/i);
          if (nameFilter === "news" && !label.includes("news")) return false;
          if (nameFilter.startsWith("hd") && (!hdNum || `hd${hdNum[1]}` !== nameFilter)) return false;
          if (nameFilter === "others" && (hdNum || label.includes("news"))) return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!label.includes(q) && !ch.currentShow.toLowerCase().includes(q)) return false;
      }
      if (thumbFilter === "image") return Boolean(thumbnails[ch.id] || streamHealth[ch.id]?.hasVideo);
      if (thumbFilter === "broken") {
        if (thumbnails[ch.id]) return false;
        const health = streamHealth[ch.id];
        return Boolean(health && !health.hasVideo);
      }
      return true;
    });
  }, [playlistChannels, searchQuery, activeNav, savedChannelIds, thumbFilter, thumbnails, streamHealth, nameFilter, playlist]);

  const nameChips = useMemo(() => {
    if (playlist === "maroc") {
      return [
        { id: "all", label: "All" },
        { id: "arryadia", label: "Arryadia" },
        { id: "2m", label: "2M" },
        { id: "alaoula", label: "Al Aoula" },
        { id: "others", label: "Others" },
      ];
    }
    const nums = [
      ...new Set(
        beinChannels
          .filter((ch) => /HD\d+/i.test(ch.displayName) && !/news/i.test(ch.displayName))
          .map((ch) => ch.displayName.match(/HD(\d+)/i)?.[1] || "")
          .filter(Boolean)
      ),
    ].sort((a, b) => Number(a) - Number(b));
    return [
      { id: "all", label: "All" },
      ...nums.map((n) => ({ id: `hd${n}`, label: `HD${n}` })),
      { id: "news", label: "News" },
      { id: "others", label: "Others" },
    ];
  }, [playlist, beinChannels]);

  const handleSelectChannel = (channel: Channel) => {
    setActiveChannel(channel);
    if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenMultiview={() => setIsMultiviewOpen(true)}
      />

      <div className="flex flex-1">
        <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />

        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            <div className="w-full lg:col-span-8">
              <MainHeroPlayer
                channel={activeChannel}
                onOpenMultiview={() => setIsMultiviewOpen(true)}
                onThumb={(channelId, dataUrl) => {
                  setThumbnails((prev) =>
                    prev[channelId] === dataUrl ? prev : { ...prev, [channelId]: dataUrl }
                  );
                  setStreamHealth((prev) => ({ ...prev, [channelId]: { hasVideo: true, hasAudio: true } }));
                }}
              />
            </div>
            <div className="w-full lg:col-span-4">
              <RecommendedStreamers
                playlist={playlist}
                onPlaylistChange={async (next) => {
                  if (next === "bein") {
                    let raw = beinRawRef.current;
                    if (raw.length === 0) {
                      raw = await fetchBeinPlaylistRaw().catch(() => []);
                      beinRawRef.current = raw;
                    }
                    raw.forEach((file) => {
                      console.log(file.path);
                      console.log(file.text);
                    });
                  } else {
                    console.log(
                      CHANNELS.map((ch) => ({
                        name: ch.name,
                        type: ch.type,
                        baseUrl: ch.baseUrl,
                        streamUrl: ch.streamUrl,
                      }))
                    );
                  }
                  setPlaylist(next);
                }}
                channels={playlistChannels}
                activeChannel={activeChannel}
                onSelectChannel={handleSelectChannel}
              />
            </div>
          </div>

          <div className="sticky top-14 z-30 -mx-4 mb-4 border-b border-zinc-800 bg-black px-4 py-3 md:-mx-6 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  {playlist === "maroc" ? "Maroc channels" : "beIN Sports"}
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {(
                    [
                      { id: "all" as const, label: "All" },
                      { id: "image" as const, label: "With image" },
                      { id: "broken" as const, label: "Broken image" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setThumbFilter(item.id)}
                      className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                        thumbFilter === item.id
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={refreshAllThumbnails}
                    disabled={refreshingAll}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-100 transition hover:bg-white/20 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshingAll ? "animate-spin" : ""}`} />
                    Refresh all
                  </button>
                  <span className="text-xs text-zinc-400">{filteredChannels.length} streams</span>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {nameChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setNameFilter(chip.id)}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium ${
                    nameFilter === chip.id
                      ? "bg-white text-zinc-900"
                      : "border border-white/10 bg-white/5 text-zinc-300 hover:text-white"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {filteredChannels.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredChannels.map((channel) => (
                <StreamCard
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === activeChannel.id}
                  thumbnail={thumbnails[channel.id]}
                  capturing={Boolean(capturingIds[channel.id])}
                  hasVideo={streamHealth[channel.id]?.hasVideo}
                  hasAudio={streamHealth[channel.id]?.hasAudio}
                  statusKnown={Boolean(streamHealth[channel.id])}
                  stillVersion={stillVersion}
                  onSelect={handleSelectChannel}
                  onRefreshThumbnail={refreshThumbnail}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/80 py-16 text-center">
              <Search className="mb-3 h-8 w-8 text-zinc-600" />
              <h3 className="text-sm font-semibold text-white">No channels found</h3>
            </div>
          )}
        </main>
      </div>

      <MultiviewModal
        isOpen={isMultiviewOpen}
        onClose={() => setIsMultiviewOpen(false)}
        channels={playlistChannels}
      />
    </div>
  );
}
