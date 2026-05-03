# Prayer Times Wallpaper

A dynamic desktop wallpaper for [Wallpaper Engine](https://www.wallpaperengine.io/) that displays Islamic prayer times with a Quranic verse header. Runs 100% offline -- all calculations are performed locally with zero network requests.

## Features

- Real-time prayer times for Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha
- 12 calculation methods (Muslim World League, Egyptian, Karachi, Umm al-Qura, and more)
- Current prayer highlighted in green, next prayer highlighted in gold
- Quranic verse from Surah An-Nisa (4:103) displayed at the top
- English and Arabic prayer names
- 12-hour / 24-hour time format toggle
- Optional animated sky with quality controls for lower-powered hardware
- Configurable coordinates via Wallpaper Engine properties panel
- Dark, brutalist design with monospace typography

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
| Latitude           | Text     | `21.4225` (Makkah)   | Geographic latitude.                             |
| Longitude          | Text     | `39.8262` (Makkah)   | Geographic longitude.                            |
| Calculation Method | Dropdown | Muslim World League  | One of 12 standard methods (Egyptian, Karachi, Umm al-Qura, Dubai, Qatar, Kuwait, Moonsighting Committee, Singapore, Turkey, Tehran, North America). |
| 24-Hour Format     | Checkbox | On                   | Toggle between 24h and 12h time display.         |
| Show Sky           | Checkbox | On                   | Enable or disable the animated sky renderer.      |
| Prayer Names Language | Dropdown | English            | Switch prayer names between English and Arabic.   |
| Sky Quality        | Dropdown | High                 | Choose High, Medium, or Low sky rendering quality. |

## Release To Wallpaper Engine

1. Run `npm run build`.
2. Open Wallpaper Engine.
3. Open the existing project from **Editor** / **Create Wallpaper** using the same local project that is already linked to the Steam Workshop item.
4. Replace or confirm the project files point at the latest built output from `dist/`.
5. Use **Steam** > **Publish Update** in the Wallpaper Engine editor.
6. Add the release notes from `CHANGELOG.md` to the Workshop update notes.
7. Publish the update.

Subscribers receive the update automatically through Steam as long as you publish to the same Workshop item instead of creating a new item.

## Tech Stack

| Library / Tool | Version | Purpose |
| -------------- | ------- | ------- |
| [Vite](https://vitejs.dev/) | 8.x | Build tooling, dev server, IIFE bundling |
| [TypeScript](https://www.typescriptlang.org/) | 6.x | Type-safe vanilla JS, no framework |
| [adhan](https://github.com/batoulapps/adhan-js) | 4.x | Astronomical prayer time calculation (offline) |

### Runtime: zero dependencies

The `adhan` library is bundled into the output at build time. The final `dist/` has no external dependencies and makes no network requests. The entire wallpaper is a single IIFE script with inlined CSS.

### Build-time Vite plugin

A custom `wallpaper-engine-compat` plugin strips `crossorigin` and `type="module"` attributes from the built HTML to ensure compatibility with Wallpaper Engine's CEF (Chromium Embedded Framework) running on the `file://` protocol.

## Project Structure

```
public/
  project.json        Wallpaper Engine descriptor (copied to dist/ on build)
  preview.png         Wallpaper preview image for Wallpaper Engine
index.html            Vite entry point, semantic HTML shell, WE property listener
src/
  main.ts             State management, adhan integration, 60s render loop
  style.css           Dark theme, CSS Grid prayer layout, current/next highlights
vite.config.ts        IIFE output, module preload disabled, crossorigin stripping
```

## License

MIT
