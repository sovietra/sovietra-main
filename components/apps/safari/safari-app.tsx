"use client";

import { useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Plus, X } from "lucide-react";
import { WindowControls } from "@/components/window-controls";
import { useWindowNavBehavior } from "@/lib/use-window-nav-behavior";

const HOME_URL = "https://sovietra.vercel.app/";

const QUICK_LINKS = [
  { label: "YouTube", url: "https://www.youtube.com" },
  { label: "Google", url: "https://www.google.com" },
  { label: "Wikipedia", url: "https://en.wikipedia.org" },
  { label: "GitHub", url: "https://github.com" },
  { label: "Reddit", url: "https://www.reddit.com" },
  { label: "X / Twitter", url: "https://x.com" },
];

interface Tab {
  id: string;
  url: string;
  inputValue: string;
  iframeKey: number;
  title: string;
}

let tabIdCounter = 1;

function makeTab(url: string = HOME_URL): Tab {
  return {
    id: String(tabIdCounter++),
    url,
    inputValue: url,
    iframeKey: 0,
    title: url === HOME_URL ? "Home" : new URL(url).hostname.replace("www.", ""),
  };
}

interface SafariAppProps {
  inShell?: boolean;
  isMobile?: boolean;
}

export function SafariApp({ inShell, isMobile }: SafariAppProps) {
  const nav = useWindowNavBehavior({ isDesktop: inShell });
  const [tabs, setTabs] = useState<Tab[]>([makeTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const navigate = useCallback(
    (id: string, target: string) => {
      let resolved = target.trim();
      if (!resolved.startsWith("http://") && !resolved.startsWith("https://")) {
        // treat as search query if it has spaces or no dot
        if (resolved.includes(" ") || !resolved.includes(".")) {
          resolved = `https://www.google.com/search?q=${encodeURIComponent(resolved)}`;
        } else {
          resolved = "https://" + resolved;
        }
      }
      let title = resolved;
      try { title = new URL(resolved).hostname.replace("www.", ""); } catch {}
      updateTab(id, { url: resolved, inputValue: resolved, iframeKey: Date.now(), title });
    },
    [updateTab]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") navigate(activeTab.id, activeTab.inputValue);
      if (e.key === "Escape") inputRef.current?.blur();
    },
    [activeTab, navigate]
  );

  const addTab = useCallback(() => {
    const tab = makeTab(HOME_URL);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setTabs((prev) => {
        if (prev.length === 1) return [makeTab()];
        const next = prev.filter((t) => t.id !== id);
        if (id === activeTabId) {
          const idx = prev.findIndex((t) => t.id === id);
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const isHome = activeTab.url === HOME_URL;

  return (
    <div className={`flex flex-col w-full bg-[#f2f2f7] ${isMobile ? "h-dvh" : "h-full"} overflow-hidden`}>
      {/* Tab bar */}
      {!isMobile && (
        <div
          className="flex items-end gap-0 px-2 pt-2 bg-[#e8e8e8] border-b border-black/10 shrink-0 select-none overflow-x-auto"
          style={{ minHeight: 36 }}
          onMouseDown={nav.onDragStart}
        >
          <div onMouseDown={(e) => e.stopPropagation()} className="flex items-end gap-0.5 min-w-0 flex-1">
            {!isMobile && (
              <div className="shrink-0 mr-1" onMouseDown={(e) => e.stopPropagation()}>
                <WindowControls
                  inShell={nav.inShell}
                  onClose={nav.onClose}
                  onMinimize={nav.onMinimize}
                  onToggleMaximize={nav.onToggleMaximize}
                  isMaximized={nav.isMaximized}
                />
              </div>
            )}
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onMouseDown={(e) => { e.stopPropagation(); setActiveTabId(tab.id); }}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] cursor-pointer shrink-0 max-w-[180px] min-w-[80px] transition-colors ${
                  tab.id === activeTabId
                    ? "bg-[#f2f2f7] text-black/80 shadow-sm"
                    : "bg-[#d8d8d8] text-black/50 hover:bg-[#e0e0e0]"
                }`}
              >
                <span className="truncate flex-1">{tab.title}</span>
                <button
                  className={`shrink-0 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-opacity ${
                    tabs.length === 1 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => closeTab(tab.id, e)}
                >
                  <X size={9} />
                </button>
              </div>
            ))}
            <button
              className="shrink-0 w-7 h-7 mb-0.5 flex items-center justify-center rounded-full hover:bg-black/10 active:bg-black/15 text-black/40 ml-0.5"
              onClick={addTab}
              onMouseDown={(e) => e.stopPropagation()}
              title="New Tab"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Address bar */}
      <div
        className={`flex items-center gap-2 bg-[#e8e8e8] border-b border-black/10 shrink-0 select-none ${isMobile ? "px-3 py-3 safe-top" : "px-3 py-1.5"}`}
        onMouseDown={nav.onDragStart}
      >
        {isMobile && (
          <div onMouseDown={(e) => e.stopPropagation()}>
            <WindowControls
              inShell={nav.inShell}
              onClose={nav.onClose}
              onMinimize={nav.onMinimize}
              onToggleMaximize={nav.onToggleMaximize}
              isMaximized={nav.isMaximized}
            />
          </div>
        )}
        <button
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 active:bg-black/15 text-black/40"
          onClick={() => navigate(activeTab.id, HOME_URL)}
          onMouseDown={(e) => e.stopPropagation()}
          title="Home"
        >
          <ChevronLeft size={isMobile ? 18 : 15} />
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 active:bg-black/15 text-black/30"
          onMouseDown={(e) => e.stopPropagation()}
          title="Forward"
          disabled
        >
          <ChevronRight size={isMobile ? 18 : 15} />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="url"
          value={activeTab.inputValue}
          onChange={(e) => updateTab(activeTab.id, { inputValue: e.target.value })}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Search or enter website name"
          className={`flex-1 px-3 rounded-xl bg-white/80 border border-black/15 text-black/80 outline-none focus:ring-2 focus:ring-blue-400/60 ${isMobile ? "h-9 text-sm" : "h-7 text-xs"}`}
          spellCheck={false}
        />
        <button
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 active:bg-black/15 text-black/40"
          onClick={() => updateTab(activeTab.id, { iframeKey: Date.now() })}
          onMouseDown={(e) => e.stopPropagation()}
          title="Refresh"
        >
          <RefreshCw size={isMobile ? 15 : 12} />
        </button>
      </div>

      {/* Browser content area */}
      <div className="flex-1 relative overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.id === activeTabId ? "block" : "hidden"}`}
          >
            {tab.url === HOME_URL ? (
              /* Start page */
              <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-[#f2f2f7] p-8">
                <div className="text-center">
                  <div className="text-4xl font-light text-black/70 mb-1">Safari</div>
                  <div className="text-sm text-black/40">Favourites</div>
                </div>
                <div className="grid grid-cols-3 gap-4 max-w-md w-full">
                  {QUICK_LINKS.map((link) => (
                    <button
                      key={link.url}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/80 hover:bg-white shadow-sm border border-black/8 transition-all hover:shadow-md"
                      onClick={() => navigate(tab.id, link.url)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold uppercase shadow-sm">
                        {link.label.slice(0, 2)}
                      </div>
                      <span className="text-[11px] text-black/60">{link.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <iframe
                key={tab.iframeKey}
                src={tab.url}
                className="w-full h-full border-none"
                title={tab.title}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
