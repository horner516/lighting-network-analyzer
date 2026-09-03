# Changelog

## 0.1.3 — 2026-09-03

- Added read-only Art-Net polling when loading or adding saved devices, plus a **Poll Nodes** button.
- Shows real reported identity, MAC address, firmware identifier, node report, and available subnet/port information.
- Replaced inventory rows with compact ProPlex-style port cards and working port detail dialogs.
- Maps IQ Two primary physical port labels separately from secondary merge and master-control bindings.
- Preserves unknown values when a node does not publish its sACN assignments, RDM setting, or subnet mask; no inferred or simulated configuration.
- Added bounded polling, timeouts, request caching, and tests for read-only enquiries and physical port mapping.

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
