"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { buildOpenMeteoForecastUrl, getWeatherDescription, getWeatherIconName } from "@/lib/weather";
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind, CloudFog } from "lucide-react";

const WIDGET_STORAGE_KEY = "desktop-widget-positions";

function loadPositions(): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(WIDGET_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePosition(id: string, pos: { x: number; y: number }) {
  const all = loadPositions();
  all[id] = pos;
  localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(all));
}

interface DraggableWidgetProps {
  id: string;
  defaultPosition: { x: number; y: number };
  editMode: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

function DraggableWidget({ id, defaultPosition, editMode, onClick, children }: DraggableWidgetProps) {
  const saved = loadPositions()[id];
  const [pos, setPos] = useState(saved ?? defaultPosition);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editMode) return;
      e.stopPropagation();
      ref.current?.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        moved: false,
      };
    },
    [editMode, pos]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
    setPos({ x: d.origX + dx, y: d.origY + dy });
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const finalPos = {
        x: d.origX + (e.clientX - d.startX),
        y: d.origY + (e.clientY - d.startY),
      };
      dragRef.current = null;
      setPos(finalPos);
      savePosition(id, finalPos);
    },
    [id]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (editMode) return;
      e.stopPropagation();
      onClick?.();
    },
    [editMode, onClick]
  );

  return (
    <div
      ref={ref}
      className="absolute select-none"
      style={{
        left: pos.x,
        top: pos.y,
        touchAction: "none",
        cursor: editMode ? "grab" : onClick ? "pointer" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={handleClick}
    >
      <div
        className="transition-transform duration-150"
        style={{
          transform: editMode ? "scale(1.03)" : "scale(1)",
          outline: editMode ? "2px solid rgba(10,132,255,0.7)" : "none",
          outlineOffset: "2px",
          borderRadius: "22px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function WidgetCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] border border-white/12 overflow-hidden ${className}`}
      style={{
        background: "rgba(28, 28, 30, 0.82)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </div>
  );
}

// --- Clock Widget ---
function ClockWidget() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  const h12 = (time.getHours() % 12 || 12).toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const ampm = time.getHours() >= 12 ? "PM" : "AM";

  return (
    <WidgetCard className="w-[152px]">
      <div className="px-5 py-4 flex flex-col items-center">
        <div className="text-white/45 text-[10px] font-semibold tracking-widest uppercase mb-1">
          Heerlen
        </div>
        <div className="text-white font-thin tracking-tight leading-none text-[52px]">
          {h12}:{minutes}
        </div>
        <div className="text-white/50 text-xs mt-1.5 font-light tracking-widest">{ampm}</div>
      </div>
    </WidgetCard>
  );
}

// --- Date Widget ---
function DateWidget() {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    setDate(new Date());
    const id = setInterval(() => setDate(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!date) return null;

  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();

  return (
    <WidgetCard className="w-[152px]">
      <div className="flex flex-col">
        <div
          className="px-4 py-2 flex items-center"
          style={{ background: "rgba(255,59,48,0.85)" }}
        >
          <span className="text-white text-[11px] font-semibold tracking-wide uppercase">
            {month}
          </span>
        </div>
        <div className="px-4 py-3 flex flex-col items-center">
          <div className="text-white font-thin text-[52px] leading-none">{day}</div>
          <div className="text-white/50 text-[11px] font-light mt-1.5 tracking-wide">{dayName}</div>
        </div>
      </div>
    </WidgetCard>
  );
}

// --- Weather Widget ---
interface WeatherData {
  temp: number;
  code: number;
  high: number;
  low: number;
}

function WeatherIcon({ code, size = 22 }: { code: number; size?: number }) {
  const name = getWeatherIconName(code);
  const props = { size, className: "text-white/90" };
  if (name === "sun") return <Sun {...props} />;
  if (name === "cloud-rain") return <CloudRain {...props} />;
  if (name === "cloud-snow") return <CloudSnow {...props} />;
  if (name === "cloud-lightning") return <CloudLightning {...props} />;
  if (name === "cloud-drizzle") return <CloudDrizzle {...props} />;
  if (name === "wind") return <Wind {...props} />;
  if (name === "cloud-fog") return <CloudFog {...props} />;
  return <Cloud {...props} />;
}

function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = buildOpenMeteoForecastUrl({
          latitude: 50.89,
          longitude: 5.98,
          currentFields: ["temperature_2m", "weather_code"],
          dailyFields: ["temperature_2m_max", "temperature_2m_min"],
          forecastDays: 1,
          temperatureUnit: "celsius",
        });
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setWeather({
            temp: data.current.temperature_2m,
            code: data.current.weather_code,
            high: data.daily.temperature_2m_max[0],
            low: data.daily.temperature_2m_min[0],
          });
        }
      } catch {
        // silently fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const desc = weather ? getWeatherDescription(weather.code) : null;

  return (
    <WidgetCard className="w-[152px]">
      <div className="px-4 py-4">
        <div className="text-white/45 text-[10px] font-semibold tracking-widest uppercase mb-2">
          Heerlen
        </div>
        {weather ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <div className="text-white font-thin text-[42px] leading-none">
                {Math.round(weather.temp)}°
              </div>
              <WeatherIcon code={weather.code} size={28} />
            </div>
            <div className="text-white/65 text-[11px] font-light mt-1">{desc}</div>
            <div className="text-white/40 text-[10px] mt-1">
              H:{Math.round(weather.high)}° L:{Math.round(weather.low)}°
            </div>
          </>
        ) : (
          <div className="text-white/30 text-xs">Loading…</div>
        )}
      </div>
    </WidgetCard>
  );
}

// --- Widget Container ---
interface DesktopWidgetsProps {
  editMode: boolean;
  onExitEditMode: () => void;
  onOpenApp: (appId: string) => void;
}

export function DesktopWidgets({ editMode, onExitEditMode, onOpenApp }: DesktopWidgetsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ESC exits edit mode
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExitEditMode();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editMode, onExitEditMode]);

  if (!mounted) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      onClick={editMode ? onExitEditMode : undefined}
      style={{ pointerEvents: editMode ? "auto" : "none" }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <DraggableWidget
          id="clock"
          defaultPosition={{ x: window.innerWidth - 188, y: 56 }}
          editMode={editMode}
        >
          <ClockWidget />
        </DraggableWidget>

        <DraggableWidget
          id="date"
          defaultPosition={{ x: window.innerWidth - 188, y: 196 }}
          editMode={editMode}
          onClick={() => onOpenApp("calendar")}
        >
          <DateWidget />
        </DraggableWidget>

        <DraggableWidget
          id="weather"
          defaultPosition={{ x: window.innerWidth - 188, y: 316 }}
          editMode={editMode}
          onClick={() => onOpenApp("weather")}
        >
          <WeatherWidget />
        </DraggableWidget>
      </div>

      {/* Edit mode "Done" button */}
      {editMode && (
        <button
          className="absolute bottom-24 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-sm font-semibold text-white shadow-lg"
          style={{
            background: "rgba(10,132,255,0.9)",
            backdropFilter: "blur(20px)",
            pointerEvents: "auto",
          }}
          onClick={(e) => { e.stopPropagation(); onExitEditMode(); }}
        >
          Done
        </button>
      )}
    </div>
  );
}
