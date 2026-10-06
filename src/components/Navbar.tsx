"use client";

import React from "react";
import { Search } from "lucide-react";

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Navbar({ searchQuery, onSearchChange }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-black">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/images/logos/adlogo.png"
            alt=""
            className="h-9 w-9 shrink-0 rounded-md object-contain"
          />
          <div className="flex min-w-0 items-baseline gap-1.5 text-[18px] font-bold tracking-tight">
            <span className="text-white">Abdelghani</span>
            <span className="text-[#1F9D4A]">DARI</span>
          </div>
        </div>

        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search channels"
            className="h-9 w-full rounded-full border border-zinc-800 bg-zinc-900/80 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900"
          />
        </div>
      </div>
    </header>
  );
}
