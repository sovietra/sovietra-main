"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { WindowControls } from "@/components/window-controls";
import { useWindowNavBehavior } from "@/lib/use-window-nav-behavior";
import { cn } from "@/lib/utils";

type Tab = "cpu" | "memory" | "energy" | "disk" | "network";

interface Process {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory: number;
  energy: number;
  diskRead: number;
  diskWrite: number;
  netSent: number;
  netRecv: number;
}

const BASE_PROCESSES = [
  { pid: 1, name: "kernel_task", user: "root", cpuBase: 12, memBase: 1800 },
  { pid: 88, name: "WindowServer", user: "root", cpuBase: 6, memBase: 480 },
  { pid: 312, name: "Dock", user: "sovietra", cpuBase: 0.4, memBase: 90 },
  { pid: 344, name: "Finder", user: "sovietra", cpuBase: 0.6, memBase: 120 },
  { pid: 501, name: "Safari", user: "sovietra", cpuBase: 2, memBase: 340 },
  { pid: 602, name: "Notes", user: "sovietra", cpuBase: 0.3, memBase: 110 },
  { pid: 703, name: "Messages", user: "sovietra", cpuBase: 0.5, memBase: 150 },
  { pid: 810, name: "Calendar", user: "sovietra", cpuBase: 0.2, memBase: 95 },
  { pid: 914, name: "Photos", user: "sovietra", cpuBase: 0.8, memBase: 260 },
  { pid: 1001, name: "com.apple.WebKit.Networking", user: "sovietra", cpuBase: 0.4, memBase: 75 },
  { pid: 1102, name: "nsurlsessiond", user: "sovietra", cpuBase: 0.1, memBase: 30 },
  { pid: 1204, name: "coreaudiod", user: "root", cpuBase: 0.5, memBase: 45 },
  { pid: 1305, name: "mds_stores", user: "root", cpuBase: 0.8, memBase: 200 },
  { pid: 1412, name: "cfprefsd", user: "sovietra", cpuBase: 0.1, memBase: 22 },
  { pid: 1523, name: "loginwindow", user: "sovietra", cpuBase: 0.1, memBase: 35 },
  { pid: 1635, name: "sharingd", user: "sovietra", cpuBase: 0.2, memBase: 28 },
];

function generateProcessData(): Process[] {
  return BASE_PROCESSES.map((p) => ({
    pid: p.pid,
    name: p.name,
    user: p.user,
    cpu: Math.max(0, p.cpuBase + (Math.random() - 0.5) * p.cpuBase * 0.8),
    memory: Math.max(10, p.memBase + (Math.random() - 0.5) * p.memBase * 0.15),
    energy: Math.floor(Math.random() * 5),
    diskRead: Math.random() * 8,
    diskWrite: Math.random() * 4,
    netSent: Math.random() * 40,
    netRecv: Math.random() * 80,
  }));
}

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Math.round(mb)} MB`;
}

function SparkGraph({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 56;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 2)}`)
    .join(" ");
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  const gradId = `grad${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "cpu", label: "CPU" },
  { id: "memory", label: "Memory" },
  { id: "energy", label: "Energy" },
  { id: "disk", label: "Disk" },
  { id: "network", label: "Network" },
];

function getColumns(tab: Tab): string {
  if (tab === "cpu") return "1fr 72px 80px 52px";
  if (tab === "memory") return "1fr 100px 80px 52px";
  if (tab === "energy") return "1fr 110px 52px";
  if (tab === "disk") return "1fr 100px 110px 52px";
  return "1fr 100px 110px 52px";
}

function getHeaders(tab: Tab): string[] {
  if (tab === "cpu") return ["Process Name", "% CPU", "CPU Time", "PID"];
  if (tab === "memory") return ["Process Name", "Memory", "Private Mem", "PID"];
  if (tab === "energy") return ["Process Name", "Energy Impact", "PID"];
  if (tab === "disk") return ["Process Name", "Bytes Read", "Bytes Written", "PID"];
  return ["Process Name", "Bytes Sent", "Bytes Rcvd", "PID"];
}

function getRow(tab: Tab, p: Process): string[] {
  if (tab === "cpu")
    return [p.name, `${p.cpu.toFixed(1)}`, `${(p.cpu * 0.8).toFixed(1)}s`, String(p.pid)];
  if (tab === "memory")
    return [p.name, formatMemory(p.memory), formatMemory(p.memory * 0.7), String(p.pid)];
  if (tab === "energy")
    return [p.name, p.energy === 0 ? "Low" : p.energy < 3 ? "Medium" : "High", String(p.pid)];
  if (tab === "disk")
    return [p.name, `${p.diskRead.toFixed(1)} KB/s`, `${p.diskWrite.toFixed(1)} KB/s`, String(p.pid)];
  return [p.name, `${p.netSent.toFixed(1)} KB/s`, `${p.netRecv.toFixed(1)} KB/s`, String(p.pid)];
}

interface ActivityMonitorProps {
  inShell?: boolean;
}

export function ActivityMonitorApp({ inShell }: ActivityMonitorProps) {
  const nav = useWindowNavBehavior({ isDesktop: inShell });
  const [tab, setTab] = useState<Tab>("cpu");
  const [query, setQuery] = useState("");
  const [processes, setProcesses] = useState<Process[]>(() => generateProcessData());
  const [cpuHistory, setCpuHistory] = useState<number[]>(() =>
    Array.from({ length: 30 }, () => Math.random() * 35 + 8)
  );
  const [memHistory, setMemHistory] = useState<number[]>(() =>
    Array.from({ length: 30 }, () => Math.random() * 8 + 62)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const next = generateProcessData();
      setProcesses(next);
      const totalCpu = next.reduce((s, p) => s + p.cpu, 0);
      setCpuHistory((prev) => [...prev.slice(-29), Math.min(100, totalCpu)]);
      setMemHistory((prev) => [...prev.slice(-29), Math.random() * 8 + 62]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const totalCpu = processes.reduce((s, p) => s + p.cpu, 0);
  const totalMem = processes.reduce((s, p) => s + p.memory, 0);
  const totalDiskRead = processes.reduce((s, p) => s + p.diskRead, 0);
  const totalDiskWrite = processes.reduce((s, p) => s + p.diskWrite, 0);
  const totalNetSent = processes.reduce((s, p) => s + p.netSent, 0);
  const totalNetRecv = processes.reduce((s, p) => s + p.netRecv, 0);
  const totalEnergy = processes.reduce((s, p) => s + p.energy, 0);

  const sorted = [...processes]
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (tab === "cpu") return b.cpu - a.cpu;
      if (tab === "memory") return b.memory - a.memory;
      if (tab === "energy") return b.energy - a.energy;
      if (tab === "disk") return b.diskRead + b.diskWrite - (a.diskRead + a.diskWrite);
      return b.netSent + b.netRecv - (a.netSent + a.netRecv);
    });

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white overflow-hidden">
      {/* Title bar */}
      <div
        className="flex items-center px-3 py-2 bg-[#2a2a2a] border-b border-white/10 shrink-0 select-none"
        onMouseDown={nav.onDragStart}
      >
        <div onMouseDown={(e) => e.stopPropagation()}>
          <WindowControls
            inShell={nav.inShell}
            onClose={nav.onClose}
            onMinimize={nav.onMinimize}
            onToggleMaximize={nav.onToggleMaximize}
            isMaximized={nav.isMaximized}
          />
        </div>
        <span className="ml-3 text-[13px] font-medium text-white/80">Activity Monitor</span>

        {/* Tab bar */}
        <div
          className="flex items-center gap-0.5 mx-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-white/20 text-white"
                  : "text-white/45 hover:text-white/75"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Search size={11} className="text-white/40 shrink-0" />
          <input
            type="text"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent text-white/80 placeholder-white/30 text-xs outline-none w-20"
          />
        </div>
      </div>

      {/* Table header */}
      <div
        className="grid text-[10px] text-white/35 font-semibold uppercase tracking-wide px-3 py-1.5 border-b border-white/10 shrink-0 bg-[#232323]"
        style={{ gridTemplateColumns: getColumns(tab) }}
      >
        {getHeaders(tab).map((h, i) => (
          <span key={h} className={i > 0 ? "text-right" : ""}>
            {h}
          </span>
        ))}
      </div>

      {/* Process list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p) => (
          <div
            key={p.pid}
            className="grid items-center px-3 py-[5px] text-[11px] border-b border-white/5 hover:bg-white/5 transition-colors cursor-default"
            style={{ gridTemplateColumns: getColumns(tab) }}
          >
            {getRow(tab, p).map((val, i) => (
              <span
                key={i}
                className={cn(
                  "truncate",
                  i === 0 ? "text-white/85" : "text-right text-white/55"
                )}
              >
                {val}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom stats bar */}
      <div className="shrink-0 border-t border-white/10 bg-[#1a1a1a] px-4 py-3">
        {tab === "cpu" && (
          <div className="flex gap-4 items-end">
            <div className="flex-1 min-w-0">
              <SparkGraph data={cpuHistory} color="#30d158" />
            </div>
            <div className="flex flex-col gap-1 text-[11px] min-w-[130px]">
              <div className="flex justify-between">
                <span className="text-white/40">CPU Usage</span>
                <span className="text-[#30d158] font-medium">{totalCpu.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Threads</span>
                <span className="text-white/65">{processes.length * 8}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Processes</span>
                <span className="text-white/65">{processes.length}</span>
              </div>
            </div>
          </div>
        )}
        {tab === "memory" && (
          <div className="flex gap-4 items-end">
            <div className="flex-1 min-w-0">
              <SparkGraph data={memHistory} color="#0a84ff" />
            </div>
            <div className="flex flex-col gap-1 text-[11px] min-w-[145px]">
              <div className="flex justify-between">
                <span className="text-white/40">Memory Used</span>
                <span className="text-[#0a84ff] font-medium">{formatMemory(totalMem)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Physical Mem</span>
                <span className="text-white/65">16.00 GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Free</span>
                <span className="text-white/65">{formatMemory(16384 - totalMem)}</span>
              </div>
            </div>
          </div>
        )}
        {tab === "energy" && (
          <div className="text-[11px] text-white/40 text-center py-1">
            Total Energy Impact:{" "}
            <span className="text-[#ffd60a] font-medium">{totalEnergy.toFixed(1)}</span>
          </div>
        )}
        {tab === "disk" && (
          <div className="flex justify-center gap-8 text-[11px]">
            <span className="text-white/40">
              Read:{" "}
              <span className="text-[#30d158] font-medium">{totalDiskRead.toFixed(1)} KB/s</span>
            </span>
            <span className="text-white/40">
              Write:{" "}
              <span className="text-[#ff453a] font-medium">{totalDiskWrite.toFixed(1)} KB/s</span>
            </span>
          </div>
        )}
        {tab === "network" && (
          <div className="flex justify-center gap-8 text-[11px]">
            <span className="text-white/40">
              Sent:{" "}
              <span className="text-[#0a84ff] font-medium">{totalNetSent.toFixed(1)} KB/s</span>
            </span>
            <span className="text-white/40">
              Received:{" "}
              <span className="text-[#30d158] font-medium">{totalNetRecv.toFixed(1)} KB/s</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
