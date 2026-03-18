"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { APPS } from "@/lib/app-config";
import { Search, X } from "lucide-react";

interface LaunchpadProps {
  onOpenApp: (appId: string) => void;
  onClose: () => void;
}

export function Launchpad({ onOpenApp, onClose }: LaunchpadProps) {
  const [query, setQuery] = useState("");

  const filtered = APPS.filter((app) =>
    app.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleAppClick = useCallback(
    (appId: string) => {
      onOpenApp(appId);
      onClose();
    },
    [onOpenApp, onClose]
  );

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col items-center pt-14 pb-28"
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(48px) saturate(180%)",
      }}
      onClick={onClose}
    >
      {/* Search bar */}
      <div
        className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-4 py-2 mb-10 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <Search size={13} className="text-white/60 shrink-0" />
        <input
          autoFocus
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent text-white placeholder-white/50 text-sm outline-none flex-1"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="text-white/50 hover:text-white/80"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* App grid */}
      <div
        className="grid gap-x-4 gap-y-7 px-16 max-w-4xl w-full"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {filtered.map((app) => (
          <button
            key={app.id}
            className="flex flex-col items-center gap-2 group cursor-pointer outline-none"
            onClick={() => handleAppClick(app.id)}
          >
            <div className="w-[68px] h-[68px] flex items-center justify-center transition-transform duration-150 group-hover:scale-110 group-active:scale-95">
              <Image
                src={app.icon}
                alt={app.name}
                width={68}
                height={68}
                className="object-contain [filter:drop-shadow(0_4px_12px_rgba(0,0,0,0.5))]"
                unoptimized
              />
            </div>
            <span className="text-white text-[11px] text-center font-medium leading-tight drop-shadow max-w-[90px] line-clamp-2">
              {app.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
