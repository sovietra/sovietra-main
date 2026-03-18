"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Layers, Navigation, Plus, Minus, X, Map as MapIcon, ChevronLeft } from "lucide-react";
import { WindowControls } from "@/components/window-controls";
import { useWindowNavBehavior } from "@/lib/use-window-nav-behavior";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MapsAppProps { inShell?: boolean; isMobile?: boolean; }
type ViewMode = "solar" | "globe" | "map";
type MapLayer = "standard" | "satellite";

// ─── Planet data ──────────────────────────────────────────────────────────────
interface Planet {
  id: string; name: string; emoji: string;
  orbitR: number;   // px from sun centre in canvas
  bodyR: number;    // visual radius in canvas
  speed: number;    // rad/s (×animation multiplier)
  angle0: number;   // initial angle
  color: string;    // base colour
  lightColor: string;
  darkColor: string;
  hasRings?: boolean;
  atmosphereColor: string;
  description: string;
}

const PLANETS: Planet[] = [
  { id:"sun",     name:"Sun",     emoji:"☀️",  orbitR:0,   bodyR:32, speed:0,       angle0:0,   color:"#FFC83D", lightColor:"#FFE680", darkColor:"#E68000", atmosphereColor:"#FFA500", description:"Our star · 1.4 million km wide" },
  { id:"mercury", name:"Mercury", emoji:"🪨",  orbitR:72,  bodyR:5,  speed:0.047,   angle0:0.6, color:"#A8A8A8", lightColor:"#C8C8C8", darkColor:"#787878", atmosphereColor:"#888888", description:"Closest planet · 88-day orbit" },
  { id:"venus",   name:"Venus",   emoji:"🌕",  orbitR:106, bodyR:8,  speed:0.018,   angle0:2.2, color:"#E8C882", lightColor:"#F5E0A0", darkColor:"#C09050", atmosphereColor:"#C8A050", description:"Hottest planet · Thick clouds" },
  { id:"earth",   name:"Earth",   emoji:"🌍",  orbitR:144, bodyR:9,  speed:0.01,    angle0:4.3, color:"#4A9FD8", lightColor:"#88CCEE", darkColor:"#285880", atmosphereColor:"#3a90ff", description:"Home · 365-day orbit" },
  { id:"mars",    name:"Mars",    emoji:"🔴",  orbitR:188, bodyR:6,  speed:0.0053,  angle0:1.1, color:"#C1440E", lightColor:"#E87040", darkColor:"#801800", atmosphereColor:"#E06020", description:"Red Planet · 687-day orbit" },
  { id:"jupiter", name:"Jupiter", emoji:"🪐",  orbitR:250, bodyR:22, speed:0.00084, angle0:3.6, color:"#C8924A", lightColor:"#E8B87A", darkColor:"#906030", atmosphereColor:"#C8A050", description:"Largest planet · 12-year orbit" },
  { id:"saturn",  name:"Saturn",  emoji:"💫",  orbitR:308, bodyR:18, speed:0.00034, angle0:5.9, color:"#E4D082", lightColor:"#F5E8A0", darkColor:"#B0A050", atmosphereColor:"#D4B060", hasRings:true, description:"Ringed planet · 29-year orbit" },
  { id:"uranus",  name:"Uranus",  emoji:"🔵",  orbitR:358, bodyR:13, speed:0.00012, angle0:2.9, color:"#7DDDDD", lightColor:"#AAEEFF", darkColor:"#409090", atmosphereColor:"#50C8C8", description:"Ice giant · 84-year orbit" },
  { id:"neptune", name:"Neptune", emoji:"🌀",  orbitR:402, bodyR:12, speed:0.00006, angle0:1.4, color:"#3F54BA", lightColor:"#6080E0", darkColor:"#202880", atmosphereColor:"#4060D0", description:"Windiest planet · 165-year orbit" },
];

// ─── Deterministic RNG ────────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// ─── Noise helpers for photorealistic textures ────────────────────────────────
function nh(ix: number, iy: number): number {
  let h = (ix * 1619 + iy * 31337 + 1013904223) | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff);
}
function sn(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (
    nh(ix,   iy)   * (1-ux) * (1-uy) +
    nh(ix+1, iy)   * ux     * (1-uy) +
    nh(ix,   iy+1) * (1-ux) * uy     +
    nh(ix+1, iy+1) * ux     * uy
  );
}
function fbm(x: number, y: number, oct: number): number {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) { v += sn(x*freq, y*freq)*amp; max += amp; amp *= 0.5; freq *= 2.1; }
  return v / max;
}
function mixC(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}
function c01(v: number): number { return Math.max(0, Math.min(1, v)); }
function sstep(e0: number, e1: number, x: number): number { const t = c01((x-e0)/(e1-e0)); return t*t*(3-2*t); }
function rampColor(stops: [number, [number,number,number]][], t: number): [number,number,number] {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i+1];
    if (t <= t1) return mixC(c0, c1, (t-t0)/(t1-t0));
  }
  return stops[stops.length-1][1];
}

// ─── Canvas planet texture generator ─────────────────────────────────────────
function buildTexture(p: Planet): string {
  const W = 512, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const seed = p.id.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);

  for (let py = 0; py < H; py++) {
    const lat = (py / H - 0.5) * Math.PI; // -π/2 .. π/2
    const latN = py / H;                   // 0..1 top=north

    for (let px = 0; px < W; px++) {
      const lon = (px / W) * Math.PI * 2;
      // 3-D sample coords on unit sphere (avoids seam)
      const sx = Math.cos(lat) * Math.cos(lon);
      const sy = Math.cos(lat) * Math.sin(lon);
      const sz = Math.sin(lat);
      // Offset by seed so planets look different
      const ox = sx + seed * 0.0001, oy = sy + seed * 0.0002, oz = sz + seed * 0.0003;

      let rgb: [number,number,number] = [0,0,0];

      if (p.id === "sun") {
        // Granulation — large convection cells
        const gran1 = fbm(ox*3.5, oy*3.5+oz*0.8, 5);
        // Fine surface texture
        const gran2 = fbm(ox*8+1.3, oy*8+oz*2, 4);
        // Limb darkening: brighter at centre, darker near edge (approximated by |sz|)
        const limbFactor = 0.75 + 0.25 * Math.abs(sz);
        const base = c01(gran1 * 0.65 + gran2 * 0.35);
        rgb = rampColor([
          [0,   [210, 80,  0  ]],
          [0.3, [245, 130, 10 ]],
          [0.55,[255, 195, 40 ]],
          [0.75,[255, 235, 100]],
          [1,   [255, 252, 200]],
        ], base);
        rgb = [rgb[0]*limbFactor, rgb[1]*limbFactor, rgb[2]*limbFactor];
        // Tiny sunspots — only a few, small and round (use raw hash noise, not fbm)
        const spx = Math.floor(ox * 6 + 3), spy = Math.floor(oy * 6 + 3);
        const spHash = nh(spx * 7 + 1, spy * 13 + 5);
        if (spHash < 0.04) {
          const spInner = sn(ox * 18 + 7, oy * 18 + oz * 4 + 7);
          const m = sstep(0.55, 0.72, spInner);
          rgb = mixC(rgb, [60, 18, 0], m * 0.75);
        }

      } else if (p.id === "mercury") {
        const n = fbm(ox*3.5, oy*3.5+oz, 7);
        rgb = rampColor([
          [0,   [60,  52,  48 ]],
          [0.35,[105, 95,  88 ]],
          [0.6, [148, 138, 130]],
          [0.8, [175, 168, 160]],
          [1,   [200, 195, 190]],
        ], n);
        // Impact craters — dark rims
        const cr = fbm(ox*8+3, oy*8+oz*2, 3);
        if (cr > 0.72) { const m = sstep(0.72, 0.85, cr); rgb = mixC(rgb, [35,28,25], m*0.8); }
        // Bright central peaks
        const cp = fbm(ox*12+5, oy*12+oz*3, 2);
        if (cp > 0.82) { const m = sstep(0.82, 0.9, cp); rgb = mixC(rgb, [220,215,210], m*0.5); }

      } else if (p.id === "venus") {
        const n1 = fbm(ox*1.8, oy*1.8+oz*0.4, 5);
        const n2 = fbm(ox*4+0.7, oy*4+oz*1.5+0.7, 4);
        // Thick sulphuric cloud bands — cream/amber
        const band = Math.sin(lat*6 + n2*1.5) * 0.5 + 0.5;
        rgb = rampColor([
          [0,   [175, 130, 60 ]],
          [0.3, [210, 170, 90 ]],
          [0.6, [235, 205, 130]],
          [0.8, [245, 225, 165]],
          [1,   [250, 240, 195]],
        ], c01(n1*0.55 + band*0.45));
        // Swirling cloud wisps
        const wisp = fbm(ox*7+2, oy*7+oz*3, 3);
        rgb = mixC(rgb, [255,250,220], wisp*0.2);

      } else if (p.id === "earth") {
        // Ocean vs land via low-freq noise
        const cont = fbm(ox*1.5+0.3, oy*1.5+oz*0.9, 6);
        const isLand = cont > 0.52;
        if (isLand) {
          const elev = fbm(ox*3+1, oy*3+oz*2, 5);
          rgb = rampColor([
            [0,   [35,  90,  30 ]],
            [0.35,[60,  115, 40 ]],
            [0.6, [105, 90,  55 ]],
            [0.8, [140, 130, 110]],
            [1,   [240, 240, 245]],
          ], elev);
        } else {
          const depth = fbm(ox*2, oy*2+oz, 4);
          rgb = rampColor([
            [0,   [10,  35,  90 ]],
            [0.4, [25,  70,  150]],
            [0.7, [40,  110, 185]],
            [1,   [70,  150, 210]],
          ], depth);
        }
        // Cloud layer
        const cloud = fbm(ox*3.5+4, oy*3.5+oz*2+4, 5);
        if (cloud > 0.52) { const m = sstep(0.52, 0.78, cloud); rgb = mixC(rgb, [240,245,255], m*0.92); }
        // Polar ice caps
        const pole = Math.max(sstep(0.82, 0.96, latN), sstep(0.18, 0.04, latN));
        if (pole > 0) rgb = mixC(rgb, [235,240,250], pole);

      } else if (p.id === "mars") {
        const n1 = fbm(ox*2.5, oy*2.5+oz, 6);
        const n2 = fbm(ox*6+2, oy*6+oz*2, 4);
        rgb = rampColor([
          [0,   [90,  28,  8  ]],
          [0.3, [155, 60,  20 ]],
          [0.55,[195, 100, 45 ]],
          [0.75,[210, 140, 80 ]],
          [1,   [220, 175, 130]],
        ], c01(n1*0.65 + n2*0.35));
        // Syrtis-Major-like dark volcanic region (lon ~290°, lat ~10°N)
        const dLat = lat - 0.17, dLon = Math.atan2(Math.sin(lon-5.07), Math.cos(lon-5.07));
        const syrtis = Math.exp(-(dLat*dLat*40 + dLon*dLon*8));
        rgb = mixC(rgb, [55,22,8], syrtis*0.6);
        // Impact craters
        const cr = fbm(ox*7+1, oy*7+oz*2, 3);
        if (cr > 0.75) { const m = sstep(0.75, 0.87, cr); rgb = mixC(rgb, [60,18,6], m*0.7); }
        // Polar ice
        const pole = Math.max(sstep(0.88, 0.97, latN), sstep(0.12, 0.03, latN));
        rgb = mixC(rgb, [230,225,220], pole);
        // Dust storm highlights
        const dust = fbm(ox*5+3, oy*5+oz*1.5+3, 3);
        rgb = mixC(rgb, [215,155,90], dust*0.15);

      } else if (p.id === "jupiter") {
        // Latitude-based band index
        const bandN = fbm(ox*0.5, oy*0.5+oz*0.2, 3);
        const bandLat = Math.sin(lat*7 + bandN*2.2) * 0.5 + 0.5;
        const turb = fbm(ox*6+1.5, oy*6+oz*2.5, 5);
        const base = rampColor([
          [0,   [155, 95,  55 ]],
          [0.2, [195, 140, 80 ]],
          [0.4, [225, 185, 120]],
          [0.6, [200, 150, 90 ]],
          [0.8, [170, 110, 60 ]],
          [1,   [215, 165, 100]],
        ], c01(bandLat*0.7 + turb*0.3));
        rgb = base;
        // Great Red Spot — lat ~-22°, lon ~215°
        const grsLat = lat + 0.38, grsLon = Math.atan2(Math.sin(lon-3.75), Math.cos(lon-3.75));
        const grs = Math.exp(-(grsLat*grsLat*55 + grsLon*grsLon*14));
        rgb = mixC(rgb, [165, 45, 25], grs * 0.9);
        // Polar darkening
        const pd = Math.abs(lat) / (Math.PI/2);
        rgb = mixC(rgb, [80,50,30], pd*pd*0.4);

      } else if (p.id === "saturn") {
        const bandN = fbm(ox*0.4, oy*0.4+oz*0.1, 3);
        const bandLat = Math.sin(lat*8 + bandN*1.8) * 0.5 + 0.5;
        const turb = fbm(ox*5+2, oy*5+oz*2, 4);
        rgb = rampColor([
          [0,   [175, 148, 80 ]],
          [0.25,[210, 185, 115]],
          [0.5, [230, 210, 150]],
          [0.75,[205, 180, 110]],
          [1,   [185, 155, 85 ]],
        ], c01(bandLat*0.65 + turb*0.35));
        // Polar darkening
        const pd = Math.abs(lat) / (Math.PI/2);
        rgb = mixC(rgb, [100,85,45], pd*pd*0.35);

      } else if (p.id === "uranus") {
        const n = fbm(ox*1.5, oy*1.5+oz*0.5, 4);
        const band = Math.sin(lat*4)*0.5+0.5;
        rgb = rampColor([
          [0,   [55,  165, 175]],
          [0.4, [80,  195, 205]],
          [0.7, [105, 215, 220]],
          [1,   [140, 230, 235]],
        ], c01(n*0.55 + band*0.45));
        // Subtle haze bands
        const haze = fbm(ox*4+3, oy*4+oz*2, 3);
        rgb = mixC(rgb, [160,240,245], haze*0.18);
        // Polar darkening
        const pd = Math.abs(lat) / (Math.PI/2);
        rgb = mixC(rgb, [35,100,115], pd*0.3);

      } else if (p.id === "neptune") {
        const n1 = fbm(ox*2, oy*2+oz*0.7, 5);
        const n2 = fbm(ox*5+1, oy*5+oz*2+1, 4);
        rgb = rampColor([
          [0,   [18,  45,  140]],
          [0.3, [35,  75,  185]],
          [0.55,[55,  105, 210]],
          [0.8, [75,  135, 230]],
          [1,   [100, 165, 245]],
        ], c01(n1*0.6 + n2*0.4));
        // Great Dark Spot (~lat -20°, lon ~90°)
        const gdsLat = lat + 0.35, gdsLon = Math.atan2(Math.sin(lon-1.57), Math.cos(lon-1.57));
        const gds = Math.exp(-(gdsLat*gdsLat*50 + gdsLon*gdsLon*12));
        rgb = mixC(rgb, [12,28,90], gds*0.85);
        // Scooter white cloud (lat ~-42°, lon ~300°)
        const scLat = lat + 0.73, scLon = Math.atan2(Math.sin(lon-5.24), Math.cos(lon-5.24));
        const sc = Math.exp(-(scLat*scLat*120 + scLon*scLon*30));
        rgb = mixC(rgb, [210,225,250], sc*0.9);
        // High-altitude wispy clouds
        const cloud = fbm(ox*6+4, oy*6+oz*3+4, 4);
        if (cloud > 0.65) rgb = mixC(rgb, [200,215,245], sstep(0.65, 0.82, cloud)*0.55);
        // Polar darkening
        const pd = Math.abs(lat) / (Math.PI/2);
        rgb = mixC(rgb, [12,25,80], pd*0.35);
      }

      const idx = (py * W + px) * 4;
      d[idx]   = c01(rgb[0]/255) * 255 | 0;
      d[idx+1] = c01(rgb[1]/255) * 255 | 0;
      d[idx+2] = c01(rgb[2]/255) * 255 | 0;
      d[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

// ─── Static stars ─────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 220 }, (_, i) => {
  const r = seededRng(i * 3701);
  return { x: r(), y: r(), size: r() > 0.92 ? 1.5 : 1, opacity: 0.25 + r() * 0.75 };
});

// ─── Solar System Canvas ──────────────────────────────────────────────────────
const YSCALE = 0.38;
const SPEED_MULT = 18;

function drawFrame(
  canvas: HTMLCanvasElement,
  angles: number[],
  selId: string,
  hovId: string | null,
) {
  // Always sync canvas drawing buffer to its CSS size
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (!W || !H) return;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cx = W * 0.42, cy = H * 0.5;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#060A18";
  ctx.fillRect(0, 0, W, H);

  // Stars
  STARS.forEach(s => {
    ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
    ctx.fillRect(s.x * W, s.y * H, s.size, s.size);
  });

  // Orbit rings
  PLANETS.slice(1).forEach(p => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, p.orbitR, p.orbitR * YSCALE, 0, 0, Math.PI * 2);
    ctx.strokeStyle = p.id === selId ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)";
    ctx.lineWidth = p.id === selId ? 1 : 0.5;
    ctx.stroke();
  });

  // Planet positions
  const positions = PLANETS.map((p, i) => ({
    p,
    x: p.id === "sun" ? cx : cx + Math.cos(angles[i]) * p.orbitR,
    y: p.id === "sun" ? cy : cy + Math.sin(angles[i]) * p.orbitR * YSCALE,
  }));

  // Painter's sort — back to front
  [...positions].sort((a, b) => a.y - b.y).forEach(({ p, x, y }) => {
    const isSel = p.id === selId;
    const isHov = p.id === hovId;
    const r = p.bodyR;

    // Sun outer glow
    if (p.id === "sun") {
      for (let gi = 3; gi >= 1; gi--) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * gi * 1.5);
        g.addColorStop(0, `rgba(255,200,80,${0.2 / gi})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * gi * 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Saturn rings — back half
    if (p.hasRings) {
      const rx = r * 2.3, ry = r * 2.3 * YSCALE * 0.55;
      ctx.save();
      ctx.beginPath(); ctx.rect(x - rx - 2, 0, (rx + 2) * 2, y); ctx.clip();
      const rg = ctx.createLinearGradient(x - rx, y, x + rx, y);
      rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(0.3, "rgba(200,180,110,0.5)");
      rg.addColorStop(0.5, "rgba(230,210,140,0.7)"); rg.addColorStop(0.7, "rgba(200,180,110,0.5)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Planet body
    const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, 0, x, y, r);
    g.addColorStop(0, p.lightColor); g.addColorStop(0.55, p.color); g.addColorStop(1, p.darkColor);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    // Jupiter bands
    if (p.id === "jupiter") {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      [0.15,0.3,0.45,0.6,0.75,0.9].forEach((f, bi) => {
        ctx.fillStyle = bi % 2 === 0 ? "rgba(100,50,0,0.2)" : "rgba(255,200,100,0.13)";
        ctx.fillRect(x - r, y - r + f * r * 2 - 3, r * 2, 6);
      });
      ctx.restore();
    }

    // Saturn rings — front half
    if (p.hasRings) {
      const rx = r * 2.3, ry = r * 2.3 * YSCALE * 0.55;
      ctx.save();
      ctx.beginPath(); ctx.rect(x - rx - 2, y, (rx + 2) * 2, H - y); ctx.clip();
      const rg = ctx.createLinearGradient(x - rx, y, x + rx, y);
      rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(0.3, "rgba(200,180,110,0.5)");
      rg.addColorStop(0.5, "rgba(230,210,140,0.7)"); rg.addColorStop(0.7, "rgba(200,180,110,0.5)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Selection / hover ring
    if (isSel || isHov) {
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = isSel ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();
      if (isSel) {
        ctx.beginPath(); ctx.arc(x, y, r + 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    // Label
    ctx.font = `${isSel ? 600 : 400} 10px -apple-system,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = isSel ? "rgba(255,255,255,0.95)" : isHov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)";
    ctx.fillText(p.name, x, y + r + 14);
  });
}

function SolarSystemCanvas({
  selectedId, hoveredId, onSelect, onHover,
}: {
  selectedId: string; hoveredId: string | null;
  onSelect: (id: string) => void; onHover: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anglesRef = useRef<number[]>(PLANETS.map(p => p.angle0));
  const lastTRef = useRef(0);
  const rafRef = useRef(0);
  // Keep latest props accessible inside the stable RAF closure
  const propsRef = useRef({ selectedId, hoveredId });
  useEffect(() => { propsRef.current = { selectedId, hoveredId }; });

  // Single animation loop — runs once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function tick(ts: number) {
      const dt = lastTRef.current ? Math.min((ts - lastTRef.current) / 1000, 0.08) : 0;
      lastTRef.current = ts;
      PLANETS.forEach((p, i) => { anglesRef.current[i] += p.speed * SPEED_MULT * dt; });
      drawFrame(canvas!, anglesRef.current, propsRef.current.selectedId, propsRef.current.hoveredId);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // intentionally empty — stable via propsRef

  const getHit = useCallback((mx: number, my: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cx = canvas.clientWidth * 0.42, cy = canvas.clientHeight * 0.5;
    let best: string | null = null, bestD = Infinity;
    PLANETS.forEach((p, i) => {
      const px = p.id === "sun" ? cx : cx + Math.cos(anglesRef.current[i]) * p.orbitR;
      const py = p.id === "sun" ? cy : cy + Math.sin(anglesRef.current[i]) * p.orbitR * YSCALE;
      const d = Math.hypot(mx - px, my - py);
      if (d < Math.max(p.bodyR + 10, 14) && d < bestD) { bestD = d; best = p.id; }
    });
    return best;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const hit = getHit(e.clientX - r.left, e.clientY - r.top);
    if (hit) onSelect(hit);
  }, [getHit, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const hit = getHit(e.clientX - r.left, e.clientY - r.top);
    onHover(hit);
    e.currentTarget.style.cursor = hit ? "pointer" : "default";
  }, [getHit, onHover]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
    />
  );
}

// ─── Planet Globe View ────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Globe: any; }
}

// Real photo textures (Solar System Scope, CC BY 4.0, equirectangular 2K)
const PLANET_TEX_URLS: Record<string, string> = {
  sun:     "https://www.solarsystemscope.com/textures/download/2k_sun.jpg",
  mercury: "https://www.solarsystemscope.com/textures/download/2k_mercury.jpg",
  venus:   "https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg",
  earth:   "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  mars:    "https://www.solarsystemscope.com/textures/download/2k_mars.jpg",
  jupiter: "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg",
  saturn:  "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg",
  uranus:  "https://www.solarsystemscope.com/textures/download/2k_uranus.jpg",
  neptune: "https://www.solarsystemscope.com/textures/download/2k_neptune.jpg",
};

// Cache: planet.id → resolved URL (real photo or data-URL fallback)
const resolvedTexCache = new Map<string, string>();

function PlanetGlobeView({ planet }: { planet: Planet }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [texUrl, setTexUrl] = useState<string | null>(null);

  // 1. Load globe.gl from CDN
  useEffect(() => {
    if (window.Globe) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/globe.gl@2.27.2/dist/globe.gl.min.js";
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);

  // 2. Resolve texture: try real photo URL (crossOrigin test), fallback to procedural
  useEffect(() => {
    if (resolvedTexCache.has(planet.id)) {
      setTexUrl(resolvedTexCache.get(planet.id)!);
      return;
    }
    const realUrl = PLANET_TEX_URLS[planet.id];
    if (!realUrl) {
      const proc = buildTexture(planet);
      resolvedTexCache.set(planet.id, proc);
      setTexUrl(proc);
      return;
    }
    // Earth URL is from unpkg (reliable CORS) — skip test
    if (planet.id === "earth") {
      resolvedTexCache.set(planet.id, realUrl);
      setTexUrl(realUrl);
      return;
    }
    // CORS-test the real URL; fall back to procedural if blocked
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { resolvedTexCache.set(planet.id, realUrl); setTexUrl(realUrl); };
    img.onerror = () => {
      const proc = buildTexture(planet);
      resolvedTexCache.set(planet.id, proc);
      setTexUrl(proc);
    };
    img.src = realUrl;
  }, [planet]);

  // 3. Create / recreate globe once both script and texture URL are ready
  useEffect(() => {
    if (!loaded || !texUrl || !containerRef.current) return;
    if (globeRef.current) { containerRef.current.innerHTML = ""; globeRef.current = null; }

    const w = containerRef.current.clientWidth || 800;
    const h = containerRef.current.clientHeight || 560;

    const globe = window.Globe({ animateIn: true })
      .width(w).height(h)
      .backgroundColor("rgba(6,10,24,1)")
      .globeImageUrl(texUrl)
      .showAtmosphere(planet.id !== "mercury")
      .atmosphereColor(planet.atmosphereColor)
      .atmosphereAltitude(planet.id === "sun" ? 0.25 : 0.15);

    if (planet.id === "earth") {
      globe
        .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png");
    }

    globe(containerRef.current);
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = planet.id === "sun" ? 0.6 : 0.35;
    globe.controls().enableDamping = true;
    globeRef.current = globe;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      globe.width(containerRef.current.clientWidth).height(containerRef.current.clientHeight);
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); globeRef.current = null; };
  }, [loaded, texUrl, planet]);

  return (
    <div className="absolute inset-0 bg-[#060A18]">
      <div ref={containerRef} className="absolute inset-0" />
      {(!loaded || !texUrl) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/40 text-sm">Loading {planet.name}…</div>
        </div>
      )}
      {/* Planet info badge */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md text-white/70 text-[11px] px-4 py-2 rounded-full border border-white/10 text-center">
          <span className="text-white/90 font-medium mr-2">{planet.name}</span>
          {planet.description}
        </div>
      </div>
    </div>
  );
}

// ─── Earth flat map ───────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { L: any; }
}

function EarthMapView({ layer, onLayerChange }: { layer: MapLayer; onLayerChange: (l: MapLayer) => void }) {
  const mapRef2 = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showLayers, setShowLayers] = useState(false);

  const tileUrl = layer === "satellite"
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  useEffect(() => {
    if (window.L) { setReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef2.current || lMapRef.current) return;
    const map = window.L.map(mapRef2.current, { center: [30, 10], zoom: 3, zoomControl: false });
    tileRef.current = window.L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
    lMapRef.current = map;
    return () => { map.remove(); lMapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!lMapRef.current || !tileRef.current || !window.L) return;
    tileRef.current.remove();
    tileRef.current = window.L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(lMapRef.current);
  }, [tileUrl]);

  const search = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, { headers: { "Accept-Language": "en" } });
      setResults(await r.json());
    } catch { setResults([]); } finally { setSearching(false); }
  }, [query]);

  const flyTo = useCallback((r: { lat: string; lon: string; display_name: string }) => {
    if (!lMapRef.current) return;
    lMapRef.current.flyTo([+r.lat, +r.lon], 13, { duration: 1.2 });
    window.L.marker([+r.lat, +r.lon]).addTo(lMapRef.current).bindPopup(r.display_name.split(",")[0]).openPopup();
    setResults([]); setQuery(r.display_name.split(",")[0]);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 px-3 py-2 bg-white/90 backdrop-blur-md border-b border-black/10 flex items-center gap-2 z-10">
        <form className="flex-1 flex items-center gap-2" onSubmit={search}>
          <div className="relative flex-1 max-w-xs">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" />
            <input type="text" placeholder="Search places…" value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-7 pr-6 h-7 text-xs rounded-xl bg-black/8 border border-black/12 outline-none focus:ring-2 focus:ring-blue-400/60" />
            {query && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-black/30" onClick={() => { setQuery(""); setResults([]); }}><X size={10} /></button>}
          </div>
          <button type="submit" disabled={searching} className="px-3 h-7 text-xs rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">{searching ? "…" : "Go"}</button>
        </form>
        <div className="relative">
          <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/8 text-black/50" onClick={() => setShowLayers(v => !v)}><Layers size={13} /></button>
          {showLayers && (
            <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-50 w-32">
              {(["standard","satellite"] as MapLayer[]).map(l => (
                <button key={l} className={`w-full px-3 py-2 text-xs text-left hover:bg-blue-50 capitalize ${layer===l?"text-blue-600 font-semibold":"text-black/70"}`}
                  onClick={() => { onLayerChange(l); setShowLayers(false); }}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {results.length > 0 && (
        <div className="absolute top-[52px] left-3 z-30 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden max-w-xs w-72">
          {results.map((r, i) => (
            <button key={i} className="w-full px-4 py-2.5 text-left text-xs hover:bg-blue-50 border-b border-black/5 last:border-0" onClick={() => flyTo(r)}>
              <span className="font-medium block text-black/80">{r.display_name.split(",")[0]}</span>
              <span className="text-black/40 text-[10px]">{r.display_name.split(",").slice(1,3).join(",")}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 relative">
        <div ref={mapRef2} className="absolute inset-0" />
        {!ready && <div className="absolute inset-0 flex items-center justify-center bg-[#e8eaed] z-20"><div className="text-sm text-black/40">Loading…</div></div>}
        <div className="absolute bottom-8 right-4 z-20 flex flex-col gap-0.5">
          <button className="w-8 h-8 bg-white rounded-t-lg shadow flex items-center justify-center hover:bg-gray-50 text-black/60 border border-black/8" onClick={() => lMapRef.current?.zoomIn()}><Plus size={13} /></button>
          <button className="w-8 h-8 bg-white rounded-b-lg shadow flex items-center justify-center hover:bg-gray-50 text-black/60 border border-black/8 border-t-0" onClick={() => lMapRef.current?.zoomOut()}><Minus size={13} /></button>
        </div>
        <div className="absolute bottom-8 left-4 z-20">
          <button className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50 text-blue-500 border border-black/8" onClick={() => lMapRef.current?.locate({ setView: true, maxZoom: 13 })}><Navigation size={13} /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Planet selector bar ──────────────────────────────────────────────────────
function PlanetBar({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-black/70 backdrop-blur-md border-t border-white/10 overflow-x-auto select-none">
      {PLANETS.map(p => {
        const isSel = p.id === selectedId;
        return (
          <button key={p.id} onClick={() => onSelect(p.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl shrink-0 transition-all ${isSel ? "bg-white/20 ring-1 ring-white/40" : "hover:bg-white/10"}`}>
            <div className="w-5 h-5 rounded-full shadow" style={{ background: `radial-gradient(circle at 38% 38%, ${p.lightColor}, ${p.color} 55%, ${p.darkColor})` }} />
            <span className={`text-[9px] ${isSel ? "text-white" : "text-white/50"}`}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MapsApp({ inShell, isMobile }: MapsAppProps) {
  const nav = useWindowNavBehavior({ isDesktop: inShell });
  const [viewMode, setViewMode] = useState<ViewMode>("solar");
  const [selectedPlanetId, setSelectedPlanetId] = useState<string>("earth");
  const [hoveredPlanetId, setHoveredPlanetId] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>("standard");

  const selectedPlanet = useMemo(() => PLANETS.find(p => p.id === selectedPlanetId)!, [selectedPlanetId]);

  const handlePlanetSelect = useCallback((id: string) => {
    setSelectedPlanetId(id);
    setViewMode("globe");
  }, []);

  const handleBarSelect = useCallback((id: string) => {
    setSelectedPlanetId(id);
    if (viewMode === "solar") setViewMode("globe");
  }, [viewMode]);

  const showPlanetBar = viewMode !== "solar";
  const showMapToggle = viewMode === "globe" && selectedPlanetId === "earth";

  return (
    <div className={`flex flex-col w-full ${isMobile ? "h-dvh" : "h-full"} overflow-hidden bg-[#060A18]`}>
      {/* Toolbar */}
      <div
        className="flex items-center px-3 py-2 bg-[#0C1428]/95 backdrop-blur-md border-b border-white/10 shrink-0 select-none z-20"
        onMouseDown={nav.onDragStart}
        style={{ minHeight: 40 }}
      >
        <div onMouseDown={e => e.stopPropagation()} className="shrink-0">
          {!isMobile && (
            <WindowControls inShell={nav.inShell} onClose={nav.onClose} onMinimize={nav.onMinimize}
              onToggleMaximize={nav.onToggleMaximize} isMaximized={nav.isMaximized} />
          )}
        </div>

        {/* Back / title */}
        {viewMode !== "solar" ? (
          <button className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs ml-3 shrink-0"
            onMouseDown={e => e.stopPropagation()} onClick={() => setViewMode("solar")}>
            <ChevronLeft size={13} /> Solar System
          </button>
        ) : (
          <span className="text-white/60 text-xs ml-3 shrink-0">Solar System</span>
        )}

        <span className="text-white/80 text-xs font-medium absolute left-1/2 -translate-x-1/2 pointer-events-none">
          {{ solar: "Solar System", map: "Earth · Map", globe: selectedPlanet.name }[viewMode]}
        </span>

        {/* Map toggle (Earth globe only) */}
        {showMapToggle && (
          <div className="ml-auto flex items-center gap-1 bg-white/10 rounded-lg p-0.5" onMouseDown={e => e.stopPropagation()}>
            <button className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-all ${viewMode==="globe"?"bg-white/20 text-white":"text-white/40 hover:text-white/60"}`}
              onClick={() => setViewMode("globe")}>
              Globe
            </button>
            <button className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-all ${(viewMode as ViewMode)==="map"?"bg-white/20 text-white":"text-white/40 hover:text-white/60"}`}
              onClick={() => setViewMode("map")}>
              <MapIcon size={10} /> Map
            </button>
          </div>
        )}
        {!showMapToggle && viewMode !== "solar" && <div className="ml-auto" />}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === "solar" && (
          <SolarSystemCanvas
            selectedId={selectedPlanetId}
            hoveredId={hoveredPlanetId}
            onSelect={handlePlanetSelect}
            onHover={setHoveredPlanetId}
          />
        )}
        {viewMode === "globe" && <PlanetGlobeView planet={selectedPlanet} />}
        {viewMode === "map" && <EarthMapView layer={mapLayer} onLayerChange={setMapLayer} />}
      </div>

      {/* Planet bar */}
      {showPlanetBar && <PlanetBar selectedId={selectedPlanetId} onSelect={handleBarSelect} />}
    </div>
  );
}
