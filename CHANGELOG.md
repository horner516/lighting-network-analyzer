# Changelog

## 0.1.6 — 2026-09-03

- Device cards now use live ProPlex web-monitor and NETRON API polling exclusively; removed Art-Net discovery fallback for device information.
- Automatically refreshes saved devices while the dashboard is open, waiting 15 seconds between sequential polling cycles. Manual Poll Nodes remains available.
- Failed web/API polling clears current configuration and shows an explicit unavailable state; no substitute discovery data or invented health.
- Retains receive-only sACN and Art-Net traffic monitoring on Network, physical port layouts and LAN server access.

## 0.1.5 — 2026-09-03

- Added read-only ProPlex IQ Two web-monitor polling, verified against a real IQ Two 1616. Reads firmware, MAC, subnet mask, physical ports, direction, universe, protocol, RDM and configured DMX rate from the status page without image recognition or changing settings.
- Preserves unavailable fields and falls back to Art-Net when the web monitor cannot be read. Non-decimal universe formats are explicitly unsupported; out-of-range values are flagged rather than silently corrected.
- Keeps all-interface LAN serving and server address links; added a regression check for LAN binding and verified access through the host's lighting-network address.
- Preserves either legacy installed-app profile location during the Lux Link rename.
- Includes the Lux Link rename, NETRON API integration and EN12 physical port layout from 0.1.4.

## 0.1.4 — 2026-09-03

- Renamed the app, installers and dashboard to **Lux Link**, preserving the app identifier and saved browser data.
- NETRON EN12 cards now match the physical front panel: twelve compact ports in one row, numbered 1–12.

- Added read-only NETRON web API integration for device identity, firmware, MAC, subnet mask and port configuration; tested with an EN12 at firmware V2.9.2.
- NETRON cards expose direction, universe, protocol, effective RDM state, configured frame rate, merge mode and channel range. Art-Net numbering matches the device's web monitor, with native addresses in port details.
- Unknown or unavailable fields remain unreported; configuration never implies live signal presence. Non-NETRON devices retain Art-Net polling.
- ProPlex web-monitor support remains pending; unreported sACN/RDM configuration stays unknown.

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
