# Changelog

## 0.1.2 — 2026-09-03

- Added real receive-only sACN and Art-Net listeners to the desktop LAN server.
- Moved protocol information off Overview into the dedicated **Network** tab.
- Added live universe/channel viewing for channels 1–512, showing DMX values and percentages per source every 0.5 seconds.
- Clearly distinguishes zero values, missing channels, lost signals, ended sources, and receiver errors.
- Shows active universes, source information, current packet rates, and server-tracked peak packet rates.
- Supports configurable sACN multicast subscriptions and reports subscription limitations.
- Added decoder, UDP reception, channel-value, and server endpoint checks.

Device inventory remains manually added and unverified. This release does not add automatic device discovery or node-health polling.

## 0.1.1

- Removed simulated devices, readings, graphs, and health reports.
- Preserved manual IP entries with unverified health and unknown models.
- Added dashboard checks for newer GitHub releases.

## 0.1.0

- Initial standalone desktop dashboard and LAN server.
- Windows installer and universal macOS installer with matching app icons.
- Server port fallback, LAN address links, and tray/menu-bar update checks.
