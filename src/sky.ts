import { PrayerTimes } from 'adhan';

interface ColorStop {
  stop: number;
  r: number;
  g: number;
  b: number;
}

const PALETTE: ColorStop[] = [
  { stop: 0.00, r: 5, g: 7, b: 15 },
  { stop: 0.18, r: 11, g: 18, b: 48 },
  { stop: 0.22, r: 42, g: 26, b: 74 },
  { stop: 0.26, r: 194, g: 106, b: 90 },
  { stop: 0.30, r: 240, g: 160, b: 96 },
  { stop: 0.35, r: 140, g: 197, b: 232 },
  { stop: 0.50, r: 47, g: 127, b: 212 },
  { stop: 0.70, r: 107, g: 159, b: 208 },
  { stop: 0.78, r: 224, g: 122, b: 58 },
  { stop: 0.82, r: 90, g: 30, b: 62 },
  { stop: 0.88, r: 11, g: 18, b: 48 },
  { stop: 1.00, r: 5, g: 7, b: 15 },
];

const DEFAULT_QUALITY: SkyQuality = 'high';
const LUT_SIZE = 256;
const INV_1200 = 1 / 1200;
const INV_800 = 1 / 800;
const TWO_PI = Math.PI + Math.PI;

export type SkyQuality = 'high' | 'medium' | 'low';

interface SkyQualityConfig {
  fpsCap: number;
  dprCap: number;
  tileSize: number;
  shimmer: boolean;
  shimmerAmp: number;
  stars: boolean;
  twinkle: boolean;
  bodyGlow: boolean;
}

const QUALITY_CONFIG: Record<SkyQuality, SkyQualityConfig> = {
  high: {
    fpsCap: 60,
    dprCap: Infinity,
    tileSize: 5,
    shimmer: true,
    shimmerAmp: 0.08,
    stars: true,
    twinkle: true,
    bodyGlow: true,
  },
  medium: {
    fpsCap: 30,
    dprCap: 1.5,
    tileSize: 6,
    shimmer: true,
    shimmerAmp: 0.05,
    stars: true,
    twinkle: false,
    bodyGlow: true,
  },
  low: {
    fpsCap: 15,
    dprCap: 1,
    tileSize: 8,
    shimmer: false,
    shimmerAmp: 0,
    stars: false,
    twinkle: false,
    bodyGlow: false,
  },
};

// ── star alpha LUT (D) ───────────────────────────────────────────────────────
// 100 pre-built fillStyle strings, keyed by floor(twinkle * 99).
// Eliminates per-star template-literal allocation and toFixed() call each frame.
const STAR_ALPHA_LUT: string[] = new Array(100);
(function buildStarLUT() {
  for (let i = 0; i < 100; i++) {
    const alpha = (0.3 + 0.7 * (i / 99)).toFixed(2);
    STAR_ALPHA_LUT[i] = `rgba(255,255,240,${alpha})`;
  }
})();

// ── colour LUT ────────────────────────────────────────────────────────────────
// Built once at module init; replaces per-tile palette walk + lerp.
const lutR = new Uint8Array(LUT_SIZE);
const lutG = new Uint8Array(LUT_SIZE);
const lutB = new Uint8Array(LUT_SIZE);

(function buildLUT() {
  for (let i = 0; i < LUT_SIZE; i++) {
    let t = i / (LUT_SIZE - 1);
    t = Math.max(0, Math.min(1, t));
    for (let p = 0; p < PALETTE.length - 1; p++) {
      if (t >= PALETTE[p].stop && t <= PALETTE[p + 1].stop) {
        const range = PALETTE[p + 1].stop - PALETTE[p].stop;
        const frac = range === 0 ? 0 : (t - PALETTE[p].stop) / range;
        lutR[i] = (PALETTE[p].r + frac * (PALETTE[p + 1].r - PALETTE[p].r)) | 0;
        lutG[i] = (PALETTE[p].g + frac * (PALETTE[p + 1].g - PALETTE[p].g)) | 0;
        lutB[i] = (PALETTE[p].b + frac * (PALETTE[p + 1].b - PALETTE[p].b)) | 0;
        break;
      }
    }
  }
})();

function timeToArcAngle(t: number): number {
  return (1 - t) * Math.PI;
}

export interface SkyOptions {
  canvas: HTMLCanvasElement;
  getPrayerTimes: () => PrayerTimes | null;
  getNow?: () => Date;
  quality?: SkyQuality;
}

export function initSky(opts: SkyOptions): { destroy: () => void } {
  const { canvas, getPrayerTimes, getNow = () => new Date() } = opts;
  const config = QUALITY_CONFIG[opts.quality ?? DEFAULT_QUALITY];
  const tileSize = config.tileSize;
  const tileDraw = tileSize - 1; // Preserves 1px grout gap.
  const frameMs = 1000 / config.fpsCap;
  const ctx = canvas.getContext('2d')!;
  if (!ctx) return { destroy: () => { } };


  // ── tile typed arrays (rebuilt on resize) ─────────────────────────────────
  // Parallel flat arrays are faster than an array of objects in V8's hot path.
  let tileX = new Int32Array(0);
  let tileY = new Int32Array(0);
  let tileOx = new Int32Array(0);
  let tileOy = new Int32Array(0);
  let tileLut = new Uint8Array(0);   // index into lutR/G/B
  let tileTf = new Float32Array(0); // tileT, for nowBoost comparison
  let tileSeed6 = new Float32Array(0); // seed * TWO_PI, for shimmer
  let tileCount = 0;

  // Stars: prefiltered from the full tile list
  let starX = new Int32Array(0);
  let starY = new Int32Array(0);
  let starPhase = new Float32Array(0); // seed * 200, for twinkle
  let starCount = 0;

  // Pixel buffer for the mosaic — filled each frame, flushed with putImageData
  let imgData: ImageData | null = null;
  let pixBuf: Uint8ClampedArray | null = null;
  let bufW = 0; // device pixels

  let cx = 0, baseY = 0, R = 0;
  let dpr = 1, cssW = 0, cssH = 0;
  let drawSz = 0, lastFrame = 0, rafId = 0;
  let resizeObserver: ResizeObserver | null = null;

  // ── resize ─────────────────────────────────────────────────────────────────
  function resize(): void {
    dpr = Math.min(window.devicePixelRatio || 1, config.dprCap);
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (cssW === 0 || cssH === 0 || canvas.width === 0 || canvas.height === 0) {
      tileCount = 0;
      starCount = 0;
      imgData = null;
      pixBuf = null;
      return;
    }

    cx = cssW / 2;
    baseY = cssH;
    R = Math.min(cssW / 2, cssH);
    drawSz = Math.max(1, (tileDraw * dpr) | 0);

    bufW = canvas.width;          // device-pixel width
    imgData = ctx.createImageData(canvas.width, canvas.height);
    pixBuf = imgData.data;
    // Leave all pixels transparent (alpha=0). Only tile pixels get alpha=255 per frame.

    // Build tile list
    const cols = Math.ceil(cssW / tileSize);
    const rows = Math.ceil(cssH / tileSize);
    const maxTiles = cols * rows;

    const tmpX = new Int32Array(maxTiles);
    const tmpY = new Int32Array(maxTiles);
    const tmpLut = new Uint8Array(maxTiles);
    const tmpTf = new Float32Array(maxTiles);
    const tmpSeed6 = new Float32Array(maxTiles);

    const tmpSX = new Int32Array(maxTiles);
    const tmpSY = new Int32Array(maxTiles);
    const tmpSP = new Float32Array(maxTiles);

    let tc = 0, sc = 0;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const tx = col * tileSize + tileSize / 2;
        const ty = row * tileSize + tileSize / 2;
        const dx = tx - cx;
        const dy = baseY - ty;
        if (dx * dx + dy * dy > R * R || ty > baseY) continue;

        const angle = Math.atan2(dy, dx);
        const tileT = Math.max(0, Math.min(1, 1 - angle / Math.PI));
        const seed = hash(col, row);
        const isNight_ = tileT < 0.23 || tileT > 0.85;

        if (config.stars && isNight_ && seed > 0.98) {
          tmpSX[sc] = tx | 0;
          tmpSY[sc] = ty | 0;
          tmpSP[sc] = seed * 200;
          sc++;
        } else {
          tmpX[tc] = col * tileSize;
          tmpY[tc] = row * tileSize;
          tmpLut[tc] = (tileT * (LUT_SIZE - 1)) | 0;
          tmpTf[tc] = tileT;
          tmpSeed6[tc] = seed * TWO_PI;
          tc++;
        }
      }
    }

    tileX = tmpX.slice(0, tc);
    tileY = tmpY.slice(0, tc);
    tileOx = new Int32Array(tc);
    tileOy = new Int32Array(tc);
    tileLut = tmpLut.slice(0, tc);
    tileTf = tmpTf.slice(0, tc);
    tileSeed6 = tmpSeed6.slice(0, tc);
    tileCount = tc;

    for (let i = 0; i < tc; i++) {
      tileOx[i] = (tileX[i] * dpr) | 0;
      tileOy[i] = (tileY[i] * dpr) | 0;
    }

    starX = tmpSX.slice(0, sc);
    starY = tmpSY.slice(0, sc);
    starPhase = tmpSP.slice(0, sc);
    starCount = sc;
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
  }
  window.addEventListener('resize', resize);
  resize();

  // ── helpers ────────────────────────────────────────────────────────────────
  function hash(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // ── sun / moon ──────────────────────────────────────────────────────────────
  // Single radial gradient per sun/moon, no per-pixel alpha calculations.
  function drawSun(x: number, y: number, radius: number): void {
    if (config.bodyGlow) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
      grad.addColorStop(0, 'rgba(255, 200, 60, 1)');
      grad.addColorStop(0.4, 'rgba(255, 170, 40, 0.6)');
      grad.addColorStop(1, 'rgba(255, 140, 20, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.5, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fill();
  }

  function drawMoon(x: number, y: number, radius: number): void {
    ctx.save();
    if (config.bodyGlow) {
      ctx.shadowColor = 'rgba(200, 210, 255, 0.5)';
      ctx.shadowBlur = radius * 1.5;
    }
    ctx.fillStyle = '#e8e6f0';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(x + radius * 0.45, y - radius * 0.15, radius * 0.85, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  // ── render loop ────────────────────────────────────────────────────────────
  function frame(ts: number): void {
    rafId = requestAnimationFrame(frame);
    if (ts - lastFrame < frameMs) return;
    lastFrame = ts;
    if (cssW === 0 || cssH === 0 || !pixBuf || !imgData) return;

    const now = getNow();
    // Single division avoids two intermediate rounding steps (A).
    const tNow = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;

    // ── 1. Fill mosaic tiles into pixel buffer ────────────────────────────────
    // Reset entire buffer to transparent (alpha=0) so gaps and outside-dome
    // pixels are fully transparent — the page background shows through.
    pixBuf.fill(0);

    for (let i = 0; i < tileCount; i++) {
      const lut = tileLut[i];
      const shimmer = config.shimmer
        ? 1 + config.shimmerAmp * Math.sin(ts * INV_1200 + tileSeed6[i])
        : 1;
      const boost = Math.abs(tileTf[i] - tNow) < 0.015 ? 1.25 : 1;
      const scale = shimmer * boost;
      const pr = Math.min(255, lutR[lut] * scale) | 0;
      const pg = Math.min(255, lutG[lut] * scale) | 0;
      const pb = Math.min(255, lutB[lut] * scale) | 0;

      // Write TILE_DRAW×TILE_DRAW block in device pixels, alpha=255 per pixel
      const ox = tileOx[i];
      const oy = tileOy[i];

      for (let dy = 0; dy < drawSz; dy++) {
        let idx = ((oy + dy) * bufW + ox) * 4;
        for (let dx = 0; dx < drawSz; dx++) {
          pixBuf[idx] = pr;
          pixBuf[idx + 1] = pg;
          pixBuf[idx + 2] = pb;
          pixBuf[idx + 3] = 255;
          idx += 4;
        }
      }
    }

    // Flush entire pixel buffer in one call
    ctx.putImageData(imgData, 0, 0);

    // ── 2. Stars (small count, keep as fillRect for alpha blending) ───────────
    for (let i = 0; i < starCount; i++) {
      if (config.twinkle) {
        const twinkle = 0.5 + 0.5 * Math.sin(ts * INV_800 + starPhase[i]);
        ctx.fillStyle = STAR_ALPHA_LUT[(twinkle * 99) | 0];
      } else {
        ctx.fillStyle = STAR_ALPHA_LUT[75];
      }
      ctx.fillRect(starX[i] - 1, starY[i] - 1, 2, 2);
    }

    // ── 3. Sun / moon ─────────────────────────────────────────────────────────
    const sunAngle = timeToArcAngle(tNow);
    const sx = cx + (R - 16) * Math.cos(sunAngle);
    const sy = baseY - (R - 16) * Math.sin(sunAngle);

    const pt = getPrayerTimes();
    if (pt) {
      const sunriseT = (pt.sunrise.getHours() + pt.sunrise.getMinutes() / 60) / 24;
      const sunsetT = (pt.maghrib.getHours() + pt.maghrib.getMinutes() / 60) / 24;
      if (tNow >= sunriseT && tNow < sunsetT) drawSun(sx, sy, 10);
      else drawMoon(sx, sy, 10);
    } else {
      if (tNow > 0.26 && tNow < 0.78) drawSun(sx, sy, 10);
      else drawMoon(sx, sy, 10);
    }
  }

  rafId = requestAnimationFrame(frame);

  return {
    destroy: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
    },
  };
}
