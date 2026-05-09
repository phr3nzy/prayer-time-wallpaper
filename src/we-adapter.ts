import type { Language } from './display';
import type { SkyQuality } from './sky';

declare global {
  interface Window {
    __wpProps: Record<string, { value: string | boolean | number }> | null;
    __wpApply: ((props: Record<string, { value: string | boolean | number }>) => void) | undefined;
  }
}

export interface AppConfig {
  lat?: number;
  lng?: number;
  method?: string;
  use24Hour?: boolean;
  showSky?: boolean;
  skyQuality?: SkyQuality;
  language?: Language;
}

export interface ApplyResult {
  scheduleChanged: boolean;
  skyToggled: boolean;
  langChanged: boolean;
}

export function initWEAdapter(onConfig: (config: AppConfig) => void): void {
  // Wallpaper Engine may fire properties before our module runs.
  // The bootstrap script in index.html queues them in window.__wpProps.
  if (window.__wpProps) {
    onConfig(normalize(window.__wpProps));
    window.__wpProps = null;
  }

  // Wire future property changes from WE.
  window.__wpApply = (props) => onConfig(normalize(props));
}

function normalize(
  properties: Record<string, { value: string | boolean | number }>,
): AppConfig {
  const config: AppConfig = {};

  if (properties.latitude) {
    const v = parseFloat(String(properties.latitude.value));
    if (!Number.isNaN(v)) config.lat = v;
  }
  if (properties.longitude) {
    const v = parseFloat(String(properties.longitude.value));
    if (!Number.isNaN(v)) config.lng = v;
  }
  if (properties.calculationmethod) {
    config.method = String(properties.calculationmethod.value);
  }
  if (properties.use24hourformat !== undefined) {
    config.use24Hour = properties.use24hourformat.value === true;
  }
  if (properties.showsky !== undefined) {
    config.showSky = properties.showsky.value === true;
  }
  if (properties.skyquality) {
    const v = String(properties.skyquality.value) as SkyQuality;
    config.skyQuality = v;
  }
  if (properties.language) {
    const v = String(properties.language.value);
    if (v === 'en' || v === 'ar') config.language = v;
  }

  return config;
}
