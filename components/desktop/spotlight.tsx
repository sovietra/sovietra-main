"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { APPS } from "@/lib/app-config";

interface SpotlightResult {
  type: "app";
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface SpotlightProps {
  onOpenApp: (appId: string) => void;
  onClose: () => void;
}

export function Spotlight({ onOpenApp, onClose }: SpotlightProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const results: SpotlightResult[] = query.trim()
    ? APPS.filter(
        (app) =>
          app.name.toLowerCase().includes(query.toLowerCase()) ||
          app.description.toLowerCase().includes(query.toLowerCase())
      ).map((app) => ({
        type: "app",
        id: app.id,
        name: app.name,
        icon: app.icon,
        description: app.description,
      }))
    : [];

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (result: SpotlightResult) => {
      onOpenApp(result.id);
      onClose();
    },
    [onOpenApp, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    },
    [results, selectedIndex, handleSelect, onClose]
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[95] flex items-start justify-center pt-[18vh]"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Spotlight panel */}
      <div className="relative w-[620px] max-w-[90vw] rounded-2xl overflow-hidden shadow-2xl border border-white/20"
        style={{ background: "rgba(30,30,30,0.85)", backdropFilter: "blur(40px)" }}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Search size={20} className="text-white/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Spotlight Search"
            className="flex-1 bg-transparent text-white text-xl placeholder:text-white/40 outline-none"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="border-t border-white/10 py-2 max-h-[360px] overflow-y-auto">
            {results.map((result, i) => (
              <button
                key={result.id}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? "bg-blue-500/70" : "hover:bg-white/10"
                }`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <Image
                  src={result.icon}
                  alt={result.name}
                  width={36}
                  height={36}
                  className="rounded-lg shrink-0"
                  unoptimized
                />
                <div>
                  <div className="text-white text-sm font-medium">{result.name}</div>
                  <div className="text-white/50 text-xs">{result.description}</div>
                </div>
                {i === selectedIndex && (
                  <span className="ml-auto text-white/50 text-xs">Open</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {query.trim() && results.length === 0 && (
          <div className="border-t border-white/10 py-8 text-center text-white/40 text-sm">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
