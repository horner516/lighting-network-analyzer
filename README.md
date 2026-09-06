# Lux Link

Standalone desktop and web dashboard for monitoring lighting network devices (sACN, Art-Net, grandMA, ETC, TMB ProPlex, Obsidian/NETRON).

## Downloads

**Version 0.2.2:** On-demand polling for all devices, grandMA session/show-file reading, explicit reachability status, and simplified receiver streams in the native Apple-silicon menu-bar app.

The header **Layout** button opens an IP-address list. Drag the grips (mouse or touch), or use the arrow controls, to arrange dashboard cards. Delete marks a device for removal; **Undo deletions** or **Cancel** can reverse draft changes. **Save layout** applies the order and removals server-wide. Removed nodes stop being polled and may be added again by IP. Concurrent edits are rejected if the server list changed while the editor was open. After the first saved layout, automatic imports from legacy browser lists are disabled to prevent deleted devices from reappearing.

All browsers opening the same LAN server share its device list. The Mac host saves it as `devices.json` in `~/Library/Application Support/lighting-network-analyzer`; the source-only launcher uses `~/.lux-link/devices.json` (override with `LNA_DEVICE_STORE`). Browser-local entries are imported once when that browser opens the updated server. Run one server on the lighting network and have every viewer use that server's address. The dashboard has no authentication: only trusted LAN clients should be able to access it, including its shared inventory and transmitter controls.

The ProPlex reader uses read-only GET requests for `status.htm` and `protocol_setup.htm`. Selected `ArtNetEnabled` and `sACNEnabled` controls determine configured protocol, including dual mode; no forms are submitted. Green/blue accents identify protocol, not proof of DMX output. The native Mac app uses its menu-bar icon with no Dock window and offers **Open Browser**, update checks and Quit.

The installer includes the app and its LAN server. **No Node.js or developer tools are required.**

| Platform | Download | Compatibility |
| --- | --- | --- |
| macOS | [Download Mac installer](https://github.com/horner516/lighting-network-analyzer/releases/download/v0.2.2/Lux-Link-0.2.2-mac-arm64.dmg) | Apple silicon (M1 or newer), macOS 13+ |

See [all releases and checksums](https://github.com/horner516/lighting-network-analyzer/releases). GitHub's automatic **Source code** downloads are not installable apps.

**Signing status:** installers are unsigned and the Mac app is not notarized. Your operating system may show an unknown-publisher warning. On Mac, open the disk image, drag the app to Applications, then approve it in System Settings → Privacy & Security if required by your system. Follow your organization's software policy.

**Device monitoring:** Lux Link reads ProPlex IQ Two web-monitor status and NETRON web API configuration, with physical port cards. Devices are organized into Console, Nodes and Switches tabs. The Mac console integration reads session, show-file and status text from the MA Web Remote Network view and correlates active DMX streams by source IP. Add by IP saves a device and requests its available identity and port information. No simulated devices are included. See the [changelog](CHANGELOG.md).

## Device cards and polling

Saved nodes and switches are polled through their live web/API interface when the server starts and when added. A single server-owned polling cycle continues even without a browser open, with 15 seconds between completed sequential cycles. **Poll Nodes** beside the Nodes heading requests an immediate node refresh. Consoles are polled once when added and only on demand afterward with **Poll Consoles** beside the Consoles heading. The global **Poll All Devices** button refreshes consoles, nodes and switches in one shared sequential cycle. Simultaneous requests are deduplicated; browsers only read cached snapshots. Art-Net remains a receive-only traffic source on Network, not a source for device configuration.

If every supported web/API request fails, Lux Link runs four ICMP ping attempts one second apart. A reply shows **Device online** while explaining that device data is unavailable; four failed replies show **Device offline**. A web/API response also counts as online. Ping is used only as the fallback reachability check and does not provide configuration or prove lighting-data flow.

ProPlex 16-port cards use two rows of eight; NETRON EN12 uses one row of twelve. Six-port ProPlex cards use two rows of three and eight-port cards use one row. Click a port for read-only details.

### NETRON web API

The local app detects NETRON devices through their web-monitor JSON API and reads `Setting.json`, `index.json`, `IP.json`, and `DMXPorts.json`. Verified with an EN12 running V2.9.2. It retrieves device name/model, firmware, MAC, on-time, subnet mask, direction, protocol, universe, RDM configuration, frame rate, merge mode and channel range. All requests are read-only; no cue recall, configuration changes or firmware actions are performed.

Global RDM processing and per-port RDM must both be enabled for the card to show RDM on. Art-Net tile universes follow the device web monitor's numbering preference; native addresses are preserved in port details. Configured frame rate is not measured traffic. Failed optional endpoints produce partial information with an explicit warning. Non-NETRON devices are checked for a supported ProPlex web monitor; unsupported devices show polling unavailable.

Added devices appear as compact port cards. **Poll Nodes** refreshes NETRON configuration through its web API. ProPlex IQ Two configuration comes from read-only `status.htm` and `protocol_setup.htm` pages. When neither web interface is supported/reachable, the card shows polling unavailable. No configuration or lighting output is sent. Polling starts with the server and when an IP is added; requests run sequentially in one shared background cycle.

ProPlex IQ Two cards use physical A–P labels, excluding secondary merge inputs and master-control bindings. Layouts follow the earlier reference: 16 ports in two rows of eight, eight ports in one row, and six ports in two rows of three. NETRON EN12 cards display all twelve ports in one physical row, left to right. Unsupported devices do not display guessed ports. A port opens a read-only detail panel.

### ProPlex IQ Two web monitor

Verified with IQ Two 1616 master firmware 2.36. The app reads `status.htm` to obtain subnet mask, MAC, firmware, direction, universe, RDM and configured DMX rate. It reads the selected protocol controls from `protocol_setup.htm`, supporting sACN, Art-Net and dual mode; status-page protocol text is a fallback. It never submits forms, sends remote-screen controls, changes device settings or generates lighting output. No image recognition is required.

The supported status-page format identifies physical 4-, 6-, 8- or 16-port models. Only the 16-port hardware has been live-tested. Universe display must be Decimal; other formats remain unknown with a warning. Reported values outside protocol limits are displayed with an error rather than silently changed. The tested node reports port L as sACN universe 0, which is outside the valid sACN range.

If the web monitor is unreachable or its format is unsupported, current configuration is cleared and polling is shown as unavailable. Device cards never substitute Art-Net discovery information. Configuration snapshots are not continuous health monitoring or proof that DMX is reaching a fixture.

### grandMA console foundation

Add a grandMA station as type **Console**. Lux Link identifies its MA Web Remote on TCP 8080. In the packaged Mac app, a small helper uses the system WebKit and Vision frameworks to open the Remote user's Network view and read its visible Session, Show File and Status fields. It does not bundle Chromium, submit configuration, or decode proprietary MA-Net3 packets. Web Remote must be enabled, the default Remote user must be permitted to connect, and the station must have an available Web Remote connection slot. If recognition fails, the fields remain **Not reported** with the reason shown instead of being guessed.

The Web Remote is queried when the console is first added and when **Poll Consoles** is pressed; it is not part of the recurring 15-second node cycle. Opening the Network view changes only that Web Remote user's displayed window. Lux Link also lists active sACN and Art-Net universes observed with the console's source IP, including received sACN priority.

Polling requires the updated local LAN app. The hosted website cannot send Art-Net packets onto your LAN. Supported target addresses are private LAN hosts and the lighting convention of 2.x addresses. Only explicitly added IPs are queried; this is not a subnet scanner.

## Live sACN / Art-Net signals

The Mac host and `start:lan` server listen on UDP 5568 (sACN) and 6454 (Art-Net). The **Network** tab groups streams by source IP and summarizes sequential addresses, for example `sACN · 1–64`. Select one universe to expand its current rate, slots, priority, packet count, first 16 levels and last-seen state directly below that universe; selecting another stream closes the previous detail. Devices are organized on the **Devices** page.

In Network, choose sACN or Art-Net, enter a universe and a channel (1–512), then click **Display current value**. The viewer refreshes every 0.5 seconds and shows the latest received DMX value (0–255) and percentage, separately for each source. Zero is a valid reading; missing channels, timed-out streams, and ended sources show no current value. Changing the fields takes effect when you press the button. sACN multicast universes must be in the host's configured subscription range; Art-Net uses native 0-based universe numbers. Stop viewing pauses channel polling.

No demo streams or lighting output are generated. Multiple browsers share the same receiver. The hosted website cannot receive lighting-network UDP directly: use the dashboard served by the local LAN app, version 0.1.2 or later.

Peak packets/s is the highest five-second-average rate observed per protocol since this server started. It is tracked on packet receipt, even without a browser open, survives browser refreshes and signal loss, and resets when the server restarts.

### Transmitter

The **Network → Transmit** tab generates one 512-channel sACN or Art-Net universe from the local server. Transmission is stopped by default. Select the protocol, universe, channel and DMX value (0–255), then use **Set channel**. **Set entire universe to 50%** writes DMX 128 to channels 1–512. Changes are sent immediately while enabled at approximately 30 packets per second.

sACN uses standard universe multicast; Art-Net uses limited broadcast from the server. Generated output may control connected lighting equipment. Confirm the selected universe before enabling it, and stop the transmitter when testing is complete. The hosted website cannot transmit to the LAN.

Use **Network connection** to choose the local IPv4 adapter used by both Receiver and Transmit. Changing the selection restarts the listeners and forces transmit output off. sACN transmission accepts priority 0–200 and defaults to 100. Received sACN stream priority is shown in the Receiver table and console universe badges.

- sACN multicast defaults to universes **1–64** on local IPv4 adapters. Select up to 256 universes with `LNA_SACN_UNIVERSES`, e.g. `1-64,101-110`. Set `LNA_INTERFACE` to a local adapter IPv4 address to restrict multicast subscriptions. Restart after changing adapters/settings. Membership failures are displayed.
- Art-Net listens for broadcast and unicast ArtDmx reaching the host; its universe addresses are displayed **0-based**. sACN universes are 1-based. Unicast sACN addressed to the server is also accepted, regardless of multicast subscriptions.
- Presence expires after 3 seconds without a valid non-preview DMX packet. History expires after 5 minutes. Source-terminated sACN streams are marked ended immediately. Preview, alternate start codes (including priority-only packets), synchronization and discovery packets are excluded from DMX presence. This is a traffic monitor, not a console merge/output engine.
- Incoming packets are validated. Rates are five-second averages of accepted packets, not Ethernet bandwidth, output frame rate, or proof that a node received the data. Repeated sequenced packets arriving within 100 ms are deduplicated. History is limited to 1,024 source/universe entries; overflow is reported.
- Permit inbound UDP 5568/6454 and the dashboard TCP port on trusted networks. An occupied Art-Net port produces a visible listener error; it is not silently moved to another port. sACN sockets share the multicast port, with OS-dependent coexistence with other receivers.
- The hosted site cannot receive your LAN's UDP traffic. Open the **local server address** on your computer, tablet, or phone. Other VLANs, IGMP filtering, or unicast sent to other devices may hide traffic; a mirrored port/TAP may require a separate packet-capture implementation (not included).
- The API and dashboard have no login. Keep them on a trusted network; do not forward their ports to the internet. Signal observations remain in server memory and are never uploaded to the hosted site or GitHub.

## What this repo contains

- React dashboard (`app/`) with discovered-device panel and health views
- Bundled LAN server in `electron/lan-server.cjs`; development helper in `scripts/start-lan.mjs`
- Native Apple-silicon menu-bar host in `native-mac/LuxLinkHost.swift`
- Mac DMG builder in `scripts/build-mac-native.sh` and automated release builds in `.github/workflows/desktop-release.yml`

## Developer prerequisites

- Node.js 24
- pnpm 11.19.0

## Start the web app for LAN use

By default, the app uses port **47652** (high-numbered port to reduce service conflicts).
If that port is already occupied, the server automatically tries the next available port. The desktop app follows the actual listening port; it does not open the other application's service.

```bash
cd /path/to/lighting-analyzer
pnpm install
pnpm run start:lan
```

The server binds to `0.0.0.0` so other devices on your subnet can open:

`http://<server-ip>:47652`

Use the **Server IP / port** links at the top of the dashboard for the actual address. Multiple active IPv4 network interfaces are listed, and the list refreshes every 15 seconds. Choose the address on the same network as your other devices. A hosted website shows its web address instead; it cannot determine your local server's IP.

You can override:

```bash
NETWORK_ANALYZER_PORT=50000 NETWORK_ANALYZER_HOST=0.0.0.0 pnpm run start:lan
```

## Mac desktop app

The installed app serves its bundled dashboard over the LAN and starts only in the Mac menu bar. It does not automatically open a browser or Dock window. Choose **Open Browser** to view the dashboard and **Quit Lux Link** to stop the server. Allow the app through your firewall on trusted/private networks when prompted. No login is provided; do not expose the server to the public internet.

To run from source:

```bash
pnpm install
pnpm run start:lan
```

It provides:

- Menu-bar icon matching the dashboard's teal pulse logo
- Menu:
  - Open Browser
  - Check for Updates (GitHub)
  - Quit
- Manual update checks from the menu-bar icon

## Build installers locally

```bash
pnpm install
pnpm run desktop:test
pnpm run mac:native
```

Artifacts appear in `desktop-dist/`.

Build on an Apple-silicon Mac for the arm64 `.dmg`. The app and installer use the matching icon from `public/app-icon.icns`. The build embeds the current arm64 Node runtime but does not include Electron or Chromium.

Pushing a version tag such as `v0.2.2` triggers the Apple-silicon Mac build. GitHub publishes the release only after tests and the packaged-server startup check succeed. Update `package.json`, these versioned links, and `RELEASE_NOTES.md` before tagging a new version.

## Updates

The dashboard header shows its version and a **Check for updates** button. The browser asks its server to check the repository's latest public stable GitHub release against the installed server version. If newer, the browser opens the GitHub download page. A visible link is also provided if popup blocking prevents opening the window. No GitHub sign-in or token is required; the server needs internet access. Offline and rate-limit errors are displayed explicitly. The hosted website checks its own deployed version; use the local server to check your installed app.

Use **Check for Updates** in the menu-bar menu. This unsigned Mac release checks GitHub and opens the latest release for manual installation when a newer version exists. Offline checks report an error without interrupting the LAN server.

## Deployment

The page now shows the active access URL at the top of the dashboard header and links to the running server (`protocol://host:port`).

## Important notes

- No simulated devices or readings are included. NETRON on-time is reported by the device, not inferred.
- Automatic device discovery and device hardware-health monitoring remain separate, unimplemented capabilities. The included listeners report observed lighting streams only.
