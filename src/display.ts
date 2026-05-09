import type { PrayerKey } from './schedule';
import { PRAYER_KEYS } from './schedule';

export type Language = 'en' | 'ar';

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

function query<K extends string>(
  selector: string,
): Record<K, HTMLElement> {
  const map = {} as Record<K, HTMLElement>;
  for (const key of PRAYER_KEYS) {
    map[key as K] = document.querySelector<HTMLElement>(
      selector.replace('{key}', key),
    )!;
  }
  return map;
}

export interface Display {
  setClock(time: string): void;
  setCoords(text: string): void;
  setPrayerTimes(
    times: Record<PrayerKey, string>,
    current: PrayerKey | null,
    next: PrayerKey | null,
  ): void;
  setLanguage(lang: Language): void;
}

export function initDisplay(): Display {
  const $clock = document.getElementById('clock')!;
  const $coords = document.getElementById('coordinates')!;
  const $prayers = query<PrayerKey>('.prayer[data-prayer="{key}"] .time');
  const $prayerLabels = query<PrayerKey>('.prayer[data-prayer="{key}"] .label');

  return {
    setClock(time: string) {
      $clock.textContent = time;
    },
    setCoords(text: string) {
      $coords.textContent = text;
    },
    setPrayerTimes(times, current, next) {
      for (const key of PRAYER_KEYS) {
        $prayers[key].textContent = times[key];
        const card = $prayers[key].parentElement!;
        card.classList.toggle('current', key === current);
        card.classList.toggle('next', key === next);
      }
    },
    setLanguage(lang: Language) {
      document.documentElement.lang = lang;
      const isArabic = lang === 'ar';
      for (const key of PRAYER_KEYS) {
        $prayerLabels[key].textContent = PRAYER_LABELS[lang][key];
        $prayerLabels[key].dir = isArabic ? 'rtl' : 'ltr';
        $prayerLabels[key].lang = lang;
      }
    },
  };
}
