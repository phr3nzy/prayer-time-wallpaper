import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  PrayerTimes,
} from 'adhan';
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
  prayerTimes: null as PrayerTimes | null,
  lastDate: '',
};

const $clock = document.getElementById('clock')!;
const $coords = document.getElementById('coordinates')!;
const $prayers = Object.fromEntries(
  PRAYER_KEYS.map((key) => [
    key,
    document.querySelector<HTMLElement>(
      `.prayer[data-prayer="${key}"] .time`,
    )!,
  ]),
) as Record<PrayerKey, HTMLElement>;

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
updateDOM();
setInterval(updateDOM, 1_000); // 1 second to ensure accuracy when displaying the correct prayer time
