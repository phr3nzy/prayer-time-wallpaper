# Changelog

## 2026-05-03

### Added

- Added a `Show Sky` setting so users can disable the animated sky renderer on low-powered hardware.
- Added English/Arabic prayer name support through the `Prayer Names Language` setting.
- Added a `Sky Quality` setting with `High`, `Medium`, and `Low` profiles.

### Changed

- Kept `High` sky quality as the default to preserve the original visual quality.
- Optimized lower sky quality modes by reducing FPS, capping internal render DPR, increasing tile size, and disabling expensive effects where appropriate.
- Increased Arabic prayer label size for better readability.

### Fixed

- Fixed sky toggling so enabling the sky after disabling it correctly reinitializes the renderer without requiring a wallpaper reload.
- Fixed sky renderer resize observer cleanup so it disconnects when the sky renderer is destroyed.
- Removed duplicate sky-related CSS rules.
