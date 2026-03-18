"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { RecentsProvider } from "@/lib/recents-context";
import { APP_SHELL_URL_CHANGE_EVENT, pushUrl, setUrl } from "@/lib/set-url";
import type { Note as NoteType } from "@/lib/notes/types";
import {
  getShellAppIdForContext,
  getShellUrlForApp,
  parseShellLocation,
  SHELL_DEFAULT_APP_ID,
} from "@/lib/shell-routing";

const DOCK_APPS = [
  { id: "finder", icon: "/finder.png", label: "Finder" },
  { id: "notes", icon: "/notes.png", label: "Notes" },
  { id: "messages", icon: "/messages.png", label: "Messages" },
  { id: "safari", icon: "/safari.png", label: "Safari" },
  { id: "settings", icon: "/settings.png", label: "Settings" },
];

const NotesApp = dynamic(() => import("@/components/apps/notes/notes-app").then((mod) => mod.NotesApp), {
  ssr: false,
});
const MessagesApp = dynamic(
  () => import("@/components/apps/messages/messages-app").then((mod) => mod.MessagesApp),
  { ssr: false }
);
const SettingsApp = dynamic(
  () => import("@/components/apps/settings/settings-app").then((mod) => mod.SettingsApp),
  { ssr: false }
);
const ITermApp = dynamic(() => import("@/components/apps/iterm/iterm-app").then((mod) => mod.ITermApp), {
  ssr: false,
});
const FinderApp = dynamic(
  () => import("@/components/apps/finder/finder-app").then((mod) => mod.FinderApp),
  { ssr: false }
);
const PhotosApp = dynamic(() => import("@/components/apps/photos/photos-app").then((mod) => mod.PhotosApp), {
  ssr: false,
});
const CalendarApp = dynamic(
  () => import("@/components/apps/calendar/calendar-app").then((mod) => mod.CalendarApp),
  { ssr: false }
);
const WeatherApp = dynamic(
  () => import("@/components/apps/weather/weather-app").then((mod) => mod.WeatherApp),
  { ssr: false }
);
const MusicApp = dynamic(() => import("@/components/apps/music/music-app").then((mod) => mod.MusicApp), {
  ssr: false,
});
const SafariApp = dynamic(() => import("@/components/apps/safari/safari-app").then((mod) => mod.SafariApp), {
  ssr: false,
});

interface MobileShellProps {
  initialApp?: string;
  initialNoteSlug?: string;
  initialNote?: NoteType;
}

export function MobileShell({ initialApp, initialNoteSlug, initialNote }: MobileShellProps) {
  const [activeAppId, setActiveAppId] = useState<string>(
    getShellAppIdForContext(initialApp || SHELL_DEFAULT_APP_ID, "mobile")
  );
  const [activeNoteSlug, setActiveNoteSlug] = useState<string | undefined>(initialNoteSlug);

  const handleOpenAppFromFinder = useCallback((nextAppId: string) => {
    const resolvedAppId = getShellAppIdForContext(nextAppId, "mobile");
    setActiveAppId(resolvedAppId);
    const nextUrl = getShellUrlForApp(resolvedAppId, { context: "mobile" });
    if (nextUrl) {
      pushUrl(nextUrl);
    }
  }, []);

  // Determine active app from URL and load topmost windows on hydration
  useEffect(() => {
    const syncFromLocation = () => {
      const path = window.location.pathname;
      const { normalizedPathname, appId: nextAppId, noteSlug } = parseShellLocation(
        path,
        window.location.search,
        { fallbackAppId: initialApp || SHELL_DEFAULT_APP_ID, context: "mobile" }
      );

      if (path !== normalizedPathname) {
        setUrl(normalizedPathname);
      }

      setActiveAppId(nextAppId);
      setActiveNoteSlug(noteSlug);
    };

    syncFromLocation();

    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener(APP_SHELL_URL_CHANGE_EVENT, syncFromLocation);

    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener(APP_SHELL_URL_CHANGE_EVENT, syncFromLocation);
    };
  }, [initialApp]);

  const handleSwitchApp = useCallback((appId: string) => {
    const resolvedAppId = getShellAppIdForContext(appId, "mobile");
    setActiveAppId(resolvedAppId);
    const nextUrl = getShellUrlForApp(resolvedAppId, { context: "mobile" });
    if (nextUrl) pushUrl(nextUrl);
  }, []);

  return (
    <RecentsProvider>
      <div className="h-dvh flex flex-col bg-background">
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeAppId === "notes" && (
            <NotesApp
              isMobile={true}
              inShell={false}
              initialSlug={activeNoteSlug}
              initialNote={activeNoteSlug === initialNoteSlug ? initialNote : undefined}
            />
          )}
          {activeAppId === "messages" && <MessagesApp isMobile={true} inShell={false} />}
          {activeAppId === "settings" && <SettingsApp isMobile={true} inShell={false} />}
          {activeAppId === "iterm" && <ITermApp isMobile={true} inShell={false} />}
          {activeAppId === "finder" && (
            <FinderApp isMobile={true} inShell={false} onOpenApp={handleOpenAppFromFinder} />
          )}
          {activeAppId === "photos" && <PhotosApp isMobile={true} inShell={false} />}
          {activeAppId === "calendar" && <CalendarApp isMobile={true} inShell={false} />}
          {activeAppId === "weather" && <WeatherApp isMobile={true} inShell={false} />}
          {activeAppId === "music" && <MusicApp isMobile={true} />}
          {activeAppId === "safari" && <SafariApp isMobile={true} inShell={false} />}
        </div>

        {/* Mobile dock */}
        <div className="shrink-0 bg-background/80 backdrop-blur border-t border-white/10 px-4 pt-2 pb-4">
          <div className="flex items-center justify-around">
            {DOCK_APPS.map((app) => (
              <button
                key={app.id}
                onClick={() => handleSwitchApp(app.id)}
                aria-label={app.label}
                className="flex flex-col items-center gap-1 active:opacity-60 transition-opacity"
              >
                <div className={`w-14 h-14 rounded-2xl overflow-hidden ring-2 transition-all ${activeAppId === app.id ? "ring-white/60" : "ring-transparent"}`}>
                  <Image src={app.icon} alt={app.label} width={56} height={56} className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-white/60">{app.label}</span>
              </button>
            ))}
          </div>
          {/* Home indicator */}
          <div className="flex justify-center mt-2">
            <div className="w-32 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </RecentsProvider>
  );
}
