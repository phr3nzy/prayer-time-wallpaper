import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  PrayerTimes,
} from 'adhan';
import { initSky } from './sky';
import type { SkyQuality } from './sky';
import './style.css';

declare global {
  interface Window {
    __wpProps: Record<string, { value: string | boolean | number }> | null;
    __wpApply: ((props: Record<string, { value: string | boolean | number }>) => void) | undefined;
    wallpaperPropertyListener: {
      applyUserProperties: (props: Record<string, { value: string | boolean | number }>) => void;
    };
  }
}

const PRAYER_KEYS = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

type PrayerKey = (typeof PRAYER_KEYS)[number];
type Language = 'en' | 'ar';

const SKY_QUALITIES = new Set<SkyQuality>(['high', 'medium', 'low']);

const PRAYER_LABELS: Record<Language, Record<PrayerKey, string>> = {
  en: {
    fajr: 'Fajr',
    sunrise: 'Sunrise',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
  },
  ar: {
    fajr: 'الفجر',
    sunrise: 'الشروق',
    dhuhr: 'الظهر',
    asr: 'العصر',
    maghrib: 'المغرب',
    isha: 'العشاء',
  },
};

const METHODS: Record<string, () => CalculationParameters> = {
  MuslimWorldLeague: CalculationMethod.MuslimWorldLeague,
  Egyptian: CalculationMethod.Egyptian,
  Karachi: CalculationMethod.Karachi,
  UmmAlQura: CalculationMethod.UmmAlQura,
  Dubai: CalculationMethod.Dubai,
  Qatar: CalculationMethod.Qatar,
  Kuwait: CalculationMethod.Kuwait,
  MoonsightingCommittee: CalculationMethod.MoonsightingCommittee,
  Singapore: CalculationMethod.Singapore,
  Turkey: CalculationMethod.Turkey,
  Tehran: CalculationMethod.Tehran,
  NorthAmerica: CalculationMethod.NorthAmerica,
};

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
  prayerTimes: null as PrayerTimes | null,
  lastDate: '',
};

const $clock = document.getElementById('clock')!;
const $coords = document.getElementById('coordinates')!;
const $sky = document.getElementById('sky') as HTMLCanvasElement;
const $prayers = Object.fromEntries(
  PRAYER_KEYS.map((key) => [
    key,
    document.querySelector<HTMLElement>(
      `.prayer[data-prayer="${key}"] .time`,
    )!,
  ]),
) as Record<PrayerKey, HTMLElement>;
const $prayerLabels = Object.fromEntries(
  PRAYER_KEYS.map((key) => [
    key,
    document.querySelector<HTMLElement>(
      `.prayer[data-prayer="${key}"] .label`,
    )!,
  ]),
) as Record<PrayerKey, HTMLElement>;
let skyInstance: ReturnType<typeof initSky> | null = null;

function setSkyVisible(visible: boolean): void {
  if (visible) {
    skyInstance?.destroy();
    $sky.style.display = '';
    skyInstance = initSky({
      canvas: $sky,
      getPrayerTimes: () => state.prayerTimes,
      quality: state.skyQuality,
    });
  } else {
    skyInstance?.destroy();
    skyInstance = null;
    $sky.style.display = 'none';
  }
}

function updatePrayerLabels(): void {
  document.documentElement.lang = state.language;
  const isArabic = state.language === 'ar';

  for (const key of PRAYER_KEYS) {
    $prayerLabels[key].textContent = PRAYER_LABELS[state.language][key];
    $prayerLabels[key].dir = isArabic ? 'rtl' : 'ltr';
    $prayerLabels[key].lang = state.language;
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !state.use24Hour,
  });
}

function recalc(): void {
  const coords = new Coordinates(state.lat, state.lng);
  const factory = METHODS[state.method] ?? CalculationMethod.MuslimWorldLeague;
  state.prayerTimes = new PrayerTimes(coords, new Date(), factory());
  state.lastDate = todayKey();
}

function updateDOM(): void {
  if (todayKey() !== state.lastDate) recalc();

  $clock.textContent = formatTime(new Date());

  const latDir = state.lat >= 0 ? 'N' : 'S';
  const lngDir = state.lng >= 0 ? 'E' : 'W';
  $coords.textContent = `${Math.abs(state.lat).toFixed(4)}°${latDir}, ${Math.abs(state.lng).toFixed(4)}°${lngDir}`;

  if (!state.prayerTimes) return;

  const current = state.prayerTimes.currentPrayer();
  const next = state.prayerTimes.nextPrayer();

  for (const key of PRAYER_KEYS) {
    $prayers[key].textContent = formatTime(state.prayerTimes[key]);
    const card = $prayers[key].parentElement!;
    card.classList.toggle('current', key === current);
    card.classList.toggle('next', key === next);
  }
}

function handleProperties(properties: Record<string, { value: string | boolean | number }>): void {
  let changed = false;

  if (properties.latitude) {
    const v = parseFloat(String(properties.latitude.value));
    if (!Number.isNaN(v)) {
      state.lat = v;
      state.coordsFromWE = true;
      changed = true;
    }
  }

  if (properties.longitude) {
    const v = parseFloat(String(properties.longitude.value));
    if (!Number.isNaN(v)) {
      state.lng = v;
      state.coordsFromWE = true;
      changed = true;
    }
  }

  if (properties.calculationmethod) {
    const v = String(properties.calculationmethod.value);
    if (v in METHODS) {
      state.method = v;
      changed = true;
    }
  }

  if (properties.use24hourformat) {
    state.use24Hour = properties.use24hourformat.value === true;
    changed = true;
  }

  if (properties.showsky !== undefined) {
    const newVal = properties.showsky.value === true;
    if (newVal !== state.showSky) {
      state.showSky = newVal;
      setSkyVisible(state.showSky);
    }
  }

  if (properties.skyquality) {
    const skyQuality = String(properties.skyquality.value) as SkyQuality;
    if (SKY_QUALITIES.has(skyQuality) && skyQuality !== state.skyQuality) {
      state.skyQuality = skyQuality;
      if (state.showSky) setSkyVisible(true);
    }
  }

  if (properties.language) {
    const language = String(properties.language.value);
    if (language === 'en' || language === 'ar') {
      state.language = language;
      updatePrayerLabels();
    }
  }

  if (changed) {
    recalc();
    updateDOM();
  }
}

// Drain any properties WE fired before this module executed
if (window.__wpProps) {
  handleProperties(window.__wpProps);
  window.__wpProps = null;
}

// Wire future WE property changes directly to our handler
window.__wpApply = handleProperties;

recalc();
updatePrayerLabels();
updateDOM();
setInterval(updateDOM, 1_000); // 1 second to ensure accuracy when displaying the correct prayer time

setSkyVisible(state.showSky);
