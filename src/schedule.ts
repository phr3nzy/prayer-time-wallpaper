import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  PrayerTimes as AdhanPrayerTimes,
} from 'adhan';

export const PRAYER_KEYS = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

export type PrayerKey = (typeof PRAYER_KEYS)[number];

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

const ADHAN_PRAYER_MAP: Record<string, PrayerKey> = {
  fajr: 'fajr',
  sunrise: 'sunrise',
  dhuhr: 'dhuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

export interface PrayerSchedule {
  times: Record<PrayerKey, Date>;
  current(): PrayerKey | null;
  next(): PrayerKey | null;
  isDaylight(): boolean;
}

export function createSchedule(
  lat: number,
  lng: number,
  methodKey: string,
): PrayerSchedule {
  const coords = new Coordinates(lat, lng);
  const factory = METHODS[methodKey] ?? CalculationMethod.MuslimWorldLeague;
  const pt = new AdhanPrayerTimes(coords, new Date(), factory());

  const times: Record<PrayerKey, Date> = {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };

  return {
    times,
    current() {
      const raw = pt.currentPrayer();
      return raw ? ADHAN_PRAYER_MAP[raw] ?? null : null;
    },
    next() {
      const raw = pt.nextPrayer();
      return raw ? ADHAN_PRAYER_MAP[raw] ?? null : null;
    },
    isDaylight() {
      const now = new Date();
      return now >= pt.sunrise && now < pt.maghrib;
    },
  };
}
