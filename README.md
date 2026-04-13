# Prayer Times Wallpaper

A dynamic desktop wallpaper for [Wallpaper Engine](https://www.wallpaperengine.io/) that displays Islamic prayer times. Runs 100% offline -- all calculations are performed locally using the [adhan](https://github.com/batoulapps/adhan-js) library.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Wallpaper Engine](https://store.steampowered.com/app/431960/Wallpaper_Engine/) (Steam)

## Development

```bash
npm install
npm run dev
```

Opens a local dev server at `http://localhost:5173`. Changes hot-reload instantly.

## Build

```bash
npm run build
```

Produces a `dist/` folder containing the wallpaper-ready files.

## Install in Wallpaper Engine

1. Run `npm run build`.
2. Open Wallpaper Engine and click **Open Wallpaper** (bottom-left).
3. Navigate to the `dist/` folder and select `index.html`.
4. The wallpaper loads immediately. Wallpaper Engine auto-copies it to its project directory.

Alternatively, copy the contents of `dist/` directly into a new folder under:

```
Steam/steamapps/common/wallpaper_engine/projects/myprojects/<your-folder-name>/
```

## Configuration

All settings are exposed in Wallpaper Engine's right-hand properties panel:

| Property           | Type     | Default              | Description                                      |
| ------------------ | -------- | -------------------- | ------------------------------------------------ |
| Latitude           | Text     | `21.4225` (Makkah)   | Geographic latitude. Overrides auto-detection.    |
| Longitude          | Text     | `39.8262` (Makkah)   | Geographic longitude. Overrides auto-detection.   |
| Calculation Method | Dropdown | Muslim World League  | One of 12 standard methods (Egyptian, Karachi, Umm al-Qura, Dubai, Qatar, Kuwait, Moonsighting Committee, Singapore, Turkey, Tehran, North America). |
| 24-Hour Format     | Checkbox | On                   | Toggle between 24h and 12h time display.          |

### Coordinate Auto-Detection

On first load, the wallpaper attempts to read your location via the browser Geolocation API (cached system location -- no network request). If that fails or is unavailable, it falls back to the default coordinates. Setting latitude/longitude manually in the properties panel always takes priority.

## Tech Stack

- **Vite** -- build tooling
- **TypeScript** -- vanilla, no framework
- **adhan** -- astronomical prayer time calculation
- **CSS Grid** -- layout with CSS custom properties for theming

## Project Structure

```
public/project.json   Wallpaper Engine descriptor (copied to dist/ on build)
index.html            Vite entry point / semantic HTML shell
src/main.ts           State management, adhan integration, 60s render loop
src/style.css         Dark theme, prayer grid, next-prayer accent highlight
```

## License

MIT
