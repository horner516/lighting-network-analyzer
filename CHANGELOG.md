# Changelog

## 0.4.0 — 2026-09-08

- Added a review-first **Discover Devices** workspace to the Devices toolbar. Select an active network adapter, scan again, review identity evidence, choose individual results and add the selection to the shared server inventory.
- Standard discovery sends read-only ArtPoll requests to the selected adapter's directed broadcast and collects unsolicited ArtPollReply packets. ProPlex replies are validated through the existing live web monitor before their configuration is shown.
- Active sACN source addresses with recognizable MA/ETC source names are checked against the existing read-only MA Web Remote and ETC Eos OSC fingerprints. Unknown traffic sources are not automatically labeled as consoles or added.
- Added an opt-in **Deep scan** for silent devices. It is deliberately bounded to the selected adapter's `/24`, probes only HTTP/Web Remote and ETC OSC service ports, and never sends console commands, joins an MA session, changes node configuration or generates DMX.
- Discovery results identify already-configured IPs and deduplicate simultaneous scans. Device additions continue to use the server-owned inventory, so every browser sees the same devices and only the Lux Link server performs polling.

## 0.3.3 — 2026-09-08

- Fixed console additions being routed through the generic node poller by the LAN server. The saved Console type now reaches vendor detection, allowing ETC and MA cards to leave their pending state. Pending cards now read **Detecting Console Info**.

## 0.3.2 — 2026-09-08

- Expanded Network stream details with a paged channel-value reader. Previous/Next controls and a range slider navigate every DMX channel from 1–512 in 16-channel groups while values continue refreshing live.
- Added console-brand detection before console-specific polling. MA devices continue through the Web Remote reader; ETC Eos Family devices are identified through their documented OSC TCP service without sending OSC commands.
- ETC console cards show the detected brand, Eos family, responding OSC service port, and observed sACN/Art-Net universes instead of waiting for MA Web Remote metadata.
- ProPlex output cards now combine the configured port routing with Lux Link's live receiver. Matching, current network data retains the protocol color; an observable universe with no current stream shows its universe and **NO DATA** in red, matching ProPlex Manager behavior. Unsubscribed or unavailable receiver paths remain neutral rather than reporting a false fault.

## 0.3.1 — 2026-09-08

- Replaced the active Fixtures/MVR controls with a future-feature notice. The planned importer will explicitly mark incomplete MVR files and list each fixture with a missing or unusable GDTF profile, DMX mode or patch; fixture output remains disabled in this build.
- Added opt-in universe editing for supported ProPlex output ports. Each node has an **Edit ports** control, port fields follow the physical layout and keyboard tab order, and changes are staged until **Save changes** is pressed.
- ProPlex universe writes preserve the node's reported port directions, sACN priorities and RDM selections, reject input-port edits, and verify the returned configuration before reporting success.

## 0.3.0 — 2026-09-06

- Added a top-level **Fixtures** workspace with server-owned MVR import. Lux Link reads `GeneralSceneDescription.xml`, patch addresses and embedded GDTF definitions, persists the parsed rig, groups fixtures by manufacturer, model and mode, and shows unsupported profiles without guessing channel mappings.
- Added multi-universe fixture test output over selectable sACN or Art-Net. Tests include 100% output, a six-second RGB sweep, a three-second pan/tilt circle that reverses direction, a repeating three-second tilt test, and one-second Gobo Wheel 1 and 2 stepping with profile-defined rotation where available.
- Fixture types can be selected together, each test reports how many selected fixtures support it, and **Stop all tests** sends three final blackout frames per active universe before disabling output. sACN marks those frames as stream-terminated. Changing fixture selection, protocol or priority requires stopping active tests first.
- sACN fixture tests carry the selected 0–200 packet priority. The interface explicitly reports priority as unavailable for Art-Net because standard ArtDmx packets do not contain an on-wire priority field.
- MVR uploads are limited to 100 MB and ZIP resources are bounded during expansion. Encrypted, ZIP64, unsupported-compression and malformed archives are rejected. Fixture uploads and output controls are restricted to the local same-origin LAN server.

## 0.2.2 — 2026-09-06

- Added grandMA Web Remote screen reading in the native Mac app. Lux Link opens the Remote user's Network view and uses macOS text recognition to read the console's session name, show file and session status. Verified live against `192.168.1.11` as session `LITE_4`, show file `Exe summit patch`, status `IdleMaster`.
- Console Web Remote polling runs once when a console is added and only on demand afterward. Dedicated **Poll Consoles** and **Poll Nodes** controls sit beside their corresponding section headings, while the global **Poll All Devices** control refreshes consoles, nodes and switches together.
- Added explicit Device online/offline badges. After every supported web/API probe fails, the server sends four pings one second apart; a ping reply distinguishes an online device with unavailable polling data from an offline device.
- Simplified Network receiver streams by source device. Sequential universes collapse into ranges such as `sACN · 1–64`; selecting a universe opens its live detail immediately below it and closes any previously selected stream.

## 0.2.1 — 2026-09-06

- Renamed Overview to **Devices** and added Console, Nodes and Switches views. Device type is stored in the server-owned inventory and shared by every browser.
- Added initial grandMA console integration. Lux Link recognizes the MA Web Remote on TCP 8080 and correlates active sACN/Art-Net streams by source IP.
- Added a Network connection selector for the server's active IPv4 adapters. Changing adapters safely stops transmission and restarts both listeners on the selected address.
- Added separate Receiver and Transmit tabs on Network. The local server can generate one 512-channel sACN or Art-Net universe, set individual channel values, set all channels to 50% (DMX 128), and starts with transmission disabled.
- Added configurable sACN output priority from 0–200. Received sACN stream priority remains visible per source and universe.
- Replaced the Electron Mac host with a native Swift menu-bar host plus a bundled Apple-silicon Node runtime. The application retains LAN serving, UDP I/O, shared inventory and GitHub update checks without bundling Chromium.
- Mac release output is Apple silicon only. The compressed v0.2.1 DMG is approximately 43 MB; Windows and Intel Mac packages are not built for this release.
- Added a Mac packaged-server startup check and live verification with a ProPlex IQ Two 1616 at `192.168.1.101` and an MA Web Remote at `192.168.1.11`.

## 0.1.7 — 2026-09-03

- Dashboard update checks now run on the server against GitHub's latest stable release, compare the installed server version, and open the trusted download page when newer. Offline/rate-limit errors and a fallback download link remain visible.
- Removed the Lighting network heading and Device inventory subtitle. Aligned Search, Add by IP and Poll Nodes alongside Overview/Network in one responsive toolbar.
- Added a header Layout editor listing device IPs, with mouse/touch dragging, keyboard/up/down controls, draft deletion, undo and Save/Cancel. Saved order and deletions are shared across browsers and persist across server restarts.
- Deleted nodes are removed from polling; in-flight replies cannot restore them. Stale layout edits return a conflict instead of overwriting another browser's changes. Saving a layout closes automatic legacy imports so older browser lists cannot resurrect deleted devices; Add by IP remains available.
- Server-owned device inventory saved to disk and shared across all browsers. One server polling cycle runs even when no browser is open; browser refreshes read cached results instead of polling nodes.
- Existing manual entries in a browser are merged into the shared list once when that browser opens the updated server. Entries trapped in the old desktop window's separate browser profile may need to be added again.
- Mac starts as a menu-bar agent without a Dock window; Windows starts in the system tray. Open Browser launches the dashboard only when requested.
- ProPlex protocol detection reads ArtNetEnabled/sACNEnabled checkbox state from protocol_setup.htm; verified sACN-only on 10.0.26.105 and dual Art-Net/sACN on 10.0.26.104. Read-only status-page parsing remains a fallback.
- Removed verbose ProPlex snapshot text, Configuration retrieved, and Protocol was not recognized from device cards.
- Restored green sACN and blue Art-Net port accents from the approved preview, with teal for dual mode and red errors. Live-output glow requires explicit device-reported activity; configuration alone is not treated as output confirmation.
- Windows x64 and universal Mac installers are built and smoke-tested by the release workflow before publication.

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
