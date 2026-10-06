"use client";

import React from "react";
import { LayoutGrid, Tv, Bookmark } from "lucide-react";

interface SidebarProps {
  activeNav: string;
  onNavChange: (nav: string) => void;
}

export function Sidebar({ activeNav, onNavChange }: SidebarProps) {
  return (
    <aside className="sticky top-14 z-20 flex h-[calc(100vh-3.5rem)] w-16 flex-shrink-0 flex-col items-center border-r border-zinc-800 bg-black py-4">
      <nav className="flex flex-col items-center gap-2">
        <button
          onClick={() => onNavChange("browse")}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl transition ${
            activeNav === "browse" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
          title="Browse"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onNavChange("tv")}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl transition ${
            activeNav === "tv" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
          title="TV"
        >
          <Tv className="h-4 w-4" />
        </button>
        <button
          onClick={() => onNavChange("saved")}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl transition ${
            activeNav === "saved" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
          title="Saved"
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </nav>
    </aside>
  );
}
