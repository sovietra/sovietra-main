"use client";

import { useState, useEffect } from "react";

// --- Clock Widget ---
function ClockWidget() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");
  const ampm = time.getHours() >= 12 ? "PM" : "AM";
  const h12 = (time.getHours() % 12 || 12).toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center justify-center px-5 py-4 bg-white/15 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 select-none min-w-[140px]">
      <div className="text-white/90 font-thin tracking-tight leading-none text-[42px]">
        {h12}:{minutes}
      </div>
      <div className="text-white/60 text-xs mt-1 tracking-widest font-light">
        {seconds} {ampm}
      </div>
    </div>
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
  const monthDay = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <div className="flex flex-col items-center justify-center px-5 py-4 bg-white/15 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 select-none min-w-[140px]">
      <div className="text-white/55 text-xs font-light tracking-wide uppercase">{dayName}</div>
      <div className="text-white/90 text-xl font-thin mt-1">{monthDay}</div>
    </div>
  );
}

// --- Widget Container ---
export function DesktopWidgets() {
  return (
    <div
      className="absolute top-14 right-6 flex flex-col gap-3 z-10 pointer-events-auto"
      // Prevent drag-start bleeding to desktop
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ClockWidget />
      <DateWidget />
    </div>
  );
}
