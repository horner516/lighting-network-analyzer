# Lux Link

Standalone desktop and web dashboard for monitoring lighting network devices (sACN, Art-Net, grandMA, ETC, TMB ProPlex, Obsidian/NETRON).

## Downloads

The installers include the app and its LAN server. **No Node.js or developer tools are required.**

| Platform | Download | Compatibility |
| --- | --- | --- |
| Windows | [Download Windows installer](https://github.com/horner516/lighting-network-analyzer/releases/download/v0.1.5/Lux-Link-0.1.5-windows-x64.exe) | Windows 10 or later, 64-bit |
| macOS | [Download Mac installer](https://github.com/horner516/lighting-network-analyzer/releases/download/v0.1.5/Lux-Link-0.1.5-mac-universal.dmg) | Universal: Apple silicon and Intel |

See [all releases and checksums](https://github.com/horner516/lighting-network-analyzer/releases). GitHub's automatic **Source code** downloads are not installable apps.

**Initial release:** installers are unsigned and the Mac app is not notarized. Your operating system may show an unknown-publisher warning. On Mac, open the disk image, drag the app to Applications, then approve it in System Settings → Privacy & Security if required by your system. Follow your organization's software policy.

**Version 0.1.5:** Lux Link now reads ProPlex IQ Two web-monitor status and NETRON web API configuration, with physical port cards. It also includes sACN and Art-Net reception, live channel values, and read-only Art-Net device polling. Add by IP saves a device and requests its available identity and port information. No simulated devices are included. A status reply is not a continuous health check. See the [changelog](CHANGELOG.md).

## Device cards and polling

### NETRON web API

The local app detects NETRON devices through their web-monitor JSON API and reads `Setting.json`, `index.json`, `IP.json`, and `DMXPorts.json`. Verified with an EN12 running V2.9.2. It retrieves device name/model, firmware, MAC, on-time, subnet mask, direction, protocol, universe, RDM configuration, frame rate, merge mode and channel range. All requests are read-only; no cue recall, configuration changes or firmware actions are performed.

Global RDM processing and per-port RDM must both be enabled for the card to show RDM on. Art-Net tile universes follow the device web monitor's numbering preference; native addresses are preserved in port details. Configured frame rate is not measured traffic. Failed optional endpoints produce partial information with an explicit warning. Devices that do not identify as NETRON retain Art-Net polling.

Added devices appear as compact port cards. **Poll Nodes** refreshes NETRON configuration through its web API. ProPlex IQ Two configuration comes from its read-only `status.htm` page. When neither web interface is supported/reachable, ArtPoll and an ArtIpProg enquiry with all programming bits cleared provide fallback information. No configuration or lighting output is sent. Polling also runs when the page loads and when an IP is added; requests run sequentially and repeated requests are briefly cached.

ProPlex IQ Two cards use physical A–P labels, excluding secondary merge inputs and master-control bindings. Layouts follow the earlier reference: 16 ports in two rows of eight, eight ports in one row, and six ports in two rows of three. NETRON EN12 cards display all twelve ports in one physical row, left to right. Other devices show the port bindings they report. A port opens a read-only detail panel.

### ProPlex IQ Two web monitor

Verified with IQ Two 1616 master firmware 2.36. The app reads `status.htm` to obtain subnet mask, MAC, firmware, direction, universe, protocol, RDM and configured DMX rate. It never submits forms, sends remote-screen controls, changes device settings or generates lighting output. No image recognition is required.

The supported status-page format identifies physical 4-, 6-, 8- or 16-port models. Only the 16-port hardware has been live-tested. Universe display must be Decimal; other formats remain unknown with a warning. Reported values outside protocol limits are displayed with an error rather than silently changed. The tested node reports port L as sACN universe 0, which is outside the valid sACN range.

If the web monitor is unreachable or its format is unsupported, polling falls back to Art-Net with a warning. IQ Two Art-Net replies may omit sACN assignments, RDM and subnet information; these remain unknown. Configuration snapshots are not continuous health monitoring or proof that DMX is reaching a fixture.

Polling requires the updated local LAN app. The hosted website cannot send Art-Net packets onto your LAN. Supported target addresses are private LAN hosts and the lighting convention of 2.x addresses. Only explicitly added IPs are queried; this is not a subnet scanner.

## Live sACN / Art-Net signals

The Windows/Mac host and `start:lan` server listen on UDP 5568 (sACN) and 6454 (Art-Net). The **Network** tab contains protocol presence, active universes, current and peak packets/s, source name/IP, native universe number, slot count, priority, and last seen. Overview is reserved for devices.

In Network, choose sACN or Art-Net, enter a universe and a channel (1–512), then click **Display current value**. The viewer refreshes every 0.5 seconds and shows the latest received DMX value (0–255) and percentage, separately for each source. Zero is a valid reading; missing channels, timed-out streams, and ended sources show no current value. Changing the fields takes effect when you press the button. sACN multicast universes must be in the host's configured subscription range; Art-Net uses native 0-based universe numbers. Stop viewing pauses channel polling.

No demo streams or lighting output are generated. Multiple browsers share the same receiver. The hosted website cannot receive lighting-network UDP directly: use the dashboard served by the local LAN app, version 0.1.2 or later.

Peak packets/s is the highest five-second-average rate observed per protocol since this server started. It is tracked on packet receipt, even without a browser open, survives browser refreshes and signal loss, and resets when the server restarts.

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
- Windows and Mac desktop host in `electron/main.cjs`
- Installer settings in `electron-builder.json` and automated release builds in `.github/workflows/desktop-release.yml`

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

## Windows and Mac desktop app

The installed app serves its bundled dashboard over the LAN and opens a desktop window. Closing the window keeps the server running; choose **Quit** from the tray/menu-bar icon to stop it. Allow the app through your firewall on trusted/private networks when prompted. No login is provided; do not expose the server to the public internet.

To run from source:

```bash
pnpm install
pnpm run desktop
```

It provides:

- Tray icon matching the dashboard's teal pulse logo
- Tray menu:
  - Open Dashboard
  - Open in Browser
  - Check for Updates (GitHub)
  - Quit
- Manual update checks via **Right Click** tray action in production builds

## Build installers locally

```bash
pnpm install
pnpm run desktop:web
pnpm run desktop:test
# On Windows:
pnpm exec electron-builder --config electron-builder.json --win --x64 --publish never
# On Mac (both Apple silicon and Intel in one installer):
pnpm exec electron-builder --config electron-builder.json --mac --universal --publish never
```

Artifacts appear in `desktop-dist/`.

Build on Windows for the Windows installer and on Mac for `.dmg` and `.zip` packages. Windows installer, uninstaller, shortcuts, and the Mac app use matching icons derived from `public/app-icon.svg`.

Pushing a version tag such as `v0.1.1` triggers native Windows and Mac builds. GitHub publishes the release only after both builds and packaged startup checks succeed. Update `package.json`, these versioned links, and `RELEASE_NOTES.md` before tagging a new version.

## Updates

The dashboard header shows its version and a **Check for updates** button. This checks the repository's latest public stable GitHub release. If it is newer, the app opens the GitHub download page in a browser window. A visible link is also provided if popup blocking prevents opening the window. No GitHub sign-in or token is required; internet access is needed. Offline and rate-limit errors are displayed explicitly.

Use **Check for Updates** in the tray/menu-bar menu. Windows can download and install a newer release after confirmation. This unsigned Mac release checks for newer versions and opens GitHub for manual installation; seamless Mac updates require signed releases. Offline checks report an error without interrupting the LAN server.

## Deployment

The page now shows the active access URL at the top of the dashboard header and links to the running server (`protocol://host:port`).

## Important notes

- No simulated devices or readings are included. NETRON on-time is reported by the device, not inferred.
- Automatic device discovery and device hardware-health monitoring remain separate, unimplemented capabilities. The included listeners report observed lighting streams only.
