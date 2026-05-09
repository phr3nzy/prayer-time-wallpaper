import { startClock } from './clock';
import type { Display, Language } from './display';
import { initDisplay } from './display';
import type { PrayerKey, PrayerSchedule } from './schedule';
import { createSchedule, PRAYER_KEYS } from './schedule';
import type { SkyQuality } from './sky';
import { initSky } from './sky';
import './style.css';
import type { AppConfig, ApplyResult } from './we-adapter';
import { initWEAdapter } from './we-adapter';

const SKY_QUALITIES = new Set<SkyQuality>(['high', 'medium', 'low']);

const DEFAULT_LAT = 21.4225;
const DEFAULT_LNG = 39.8262;

const state = {
  lat: DEFAULT_LAT,
  lng: DEFAULT_LNG,
  coordsFromWE: false,
  method: 'MuslimWorldLeague',
  use24Hour: true,
  showSky: true,
  skyQuality: 'high' as SkyQuality,
  language: 'en' as Language,
  schedule: null as PrayerSchedule | null,
};

const display: Display = initDisplay();
const $sky = document.getElementById('sky') as HTMLCanvasElement;
let skyInstance: ReturnType<typeof initSky> | null = null;

function setSkyVisible(visible: boolean): void {
  if (visible) {
    skyInstance?.destroy();
    $sky.style.display = '';
    skyInstance = initSky({
      canvas: $sky,
      quality: state.skyQuality,
    });
    const dl = state.schedule?.isDaylight() ?? true;
    skyInstance.update(dl);
  } else {
    skyInstance?.destroy();
    skyInstance = null;
    $sky.style.display = 'none';
  }
}

// ── formatTime LUT ─────────────────────────────────────────────────────────
// Precompute all 1440 minute-strings (24h + 12h) to eliminate the
// ~15ms cold-path spike from toLocaleTimeString's ICU locale resolution.
// Two-digit pad is ~100× faster than toLocaleTimeString in V8.

const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;

const MINUTES_PER_DAY = 1440;
const time24LUT: string[] = new Array(MINUTES_PER_DAY);
const time12LUT: string[] = new Array(MINUTES_PER_DAY);

(function buildTimeLUT() {
  for (let m = 0; m < MINUTES_PER_DAY; m++) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    time24LUT[m] = `${pad2(hh)}:${pad2(mm)}`;
    const h12 = hh % 12 || 12;
    const ampm = hh < 12 ? ' AM' : ' PM';
    time12LUT[m] = `${pad2(h12)}:${pad2(mm)}${ampm}`;
  }
})();

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(date: Date): string {
  const m = minuteOfDay(date);
  return state.use24Hour ? time24LUT[m]! : time12LUT[m]!;
}

function refreshSchedule(): void {
  state.schedule = createSchedule(state.lat, state.lng, state.method);
}

// ── dirty-tracked DOM ───────────────────────────────────────────────────────
// Store last-rendered values to skip DOM writes when nothing changed.
// Clock changes every minute; prayer times change daily; coords never change
// after init. This eliminates ~99% of textContent/classList mutations per tick.

const prevRendered = {
  clock: '',
  coords: '',
  times: {} as Record<PrayerKey, string>,
  current: null as PrayerKey | null,
  next: null as PrayerKey | null,
};

function updateDOM(): void {
  const clockTime = formatTime(new Date());
  if (clockTime !== prevRendered.clock) {
    display.setClock(clockTime);
    prevRendered.clock = clockTime;
  }

  const latDir = state.lat >= 0 ? 'N' : 'S';
  const lngDir = state.lng >= 0 ? 'E' : 'W';
  const coordsText = `${Math.abs(state.lat).toFixed(4)}°${latDir}, ${Math.abs(state.lng).toFixed(4)}°${lngDir}`;
  if (coordsText !== prevRendered.coords) {
    display.setCoords(coordsText);
    prevRendered.coords = coordsText;
  }

  const schedule = state.schedule;
  if (!schedule) return;

  const current = schedule.current();
  const next = schedule.next();

  // Only re-render prayer cards if current/next transitions or times changed
  let prayerChanged = current !== prevRendered.current || next !== prevRendered.next;
  const formatted = {} as Record<PrayerKey, string>;
  for (const key of PRAYER_KEYS) {
    formatted[key] = formatTime(schedule.times[key]);
    if (formatted[key] !== prevRendered.times[key]) {
      prevRendered.times[key] = formatted[key];
      prayerChanged = true;
    }
  }

  if (prayerChanged) {
    display.setPrayerTimes(formatted, current, next);
    prevRendered.current = current;
    prevRendered.next = next;
  }
}

function tick(): void {
  const dl = state.schedule?.isDaylight() ?? true;
  skyInstance?.update(dl);
  updateDOM();
}

function applyConfig(config: AppConfig): ApplyResult {
  const result: ApplyResult = { scheduleChanged: false, skyToggled: false, langChanged: false };

  if (config.lat !== undefined) {
    state.lat = config.lat;
    state.coordsFromWE = true;
    result.scheduleChanged = true;
  }
  if (config.lng !== undefined) {
    state.lng = config.lng;
    state.coordsFromWE = true;
    result.scheduleChanged = true;
  }
  if (config.method !== undefined) {
    state.method = config.method;
    result.scheduleChanged = true;
  }
  if (config.use24Hour !== undefined) {
    state.use24Hour = config.use24Hour;
  }
  if (config.showSky !== undefined && config.showSky !== state.showSky) {
    state.showSky = config.showSky;
    result.skyToggled = true;
  }
  if (config.skyQuality !== undefined) {
    const sq = config.skyQuality;
    if (SKY_QUALITIES.has(sq) && sq !== state.skyQuality) {
      state.skyQuality = sq;
      if (state.showSky) result.skyToggled = true;
    }
  }
  if (config.language !== undefined) {
    state.language = config.language;
    result.langChanged = true;
  }

  return result;
}

initWEAdapter((config) => {
  const result = applyConfig(config);
  if (result.scheduleChanged) refreshSchedule();
  updateDOM();
  if (result.skyToggled) setSkyVisible(state.showSky);
  if (result.langChanged) display.setLanguage(state.language);
});

refreshSchedule();
display.setLanguage(state.language);
updateDOM();
startClock(tick);

setSkyVisible(state.showSky);
