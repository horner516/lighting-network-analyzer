# Lighting Network Analyzer

Standalone desktop and web dashboard for monitoring lighting network devices (sACN, Art-Net, grandMA, ETC, TMB ProPlex, Obsidian/NETRON).

## Downloads

The installers include the app and its LAN server. **No Node.js or developer tools are required.**

| Platform | Download | Compatibility |
| --- | --- | --- |
| Windows | [Download Windows installer](https://github.com/horner516/lighting-network-analyzer/releases/download/v0.1.1/Lighting-Network-Analyzer-0.1.1-windows-x64.exe) | Windows 10 or later, 64-bit |
| macOS | [Download Mac installer](https://github.com/horner516/lighting-network-analyzer/releases/download/v0.1.1/Lighting-Network-Analyzer-0.1.1-mac-universal.dmg) | Universal: Apple silicon and Intel |

See [all releases and checksums](https://github.com/horner516/lighting-network-analyzer/releases). GitHub's automatic **Source code** downloads are not installable apps.

**Initial release:** installers are unsigned and the Mac app is not notarized. Your operating system may show an unknown-publisher warning. On Mac, open the disk image, drag the app to Applications, then approve it in System Settings → Privacy & Security if required by your system. Follow your organization's software policy.

**No simulated devices:** the app starts empty and shows only entries you add manually. Automatic discovery and health monitoring are not connected yet. Manual entries are unverified; adding an IP does not check a device or synchronize entries between browsers. Unknown measurements are left blank rather than simulated.

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

- No sample devices, traffic graphs, health percentages, discovery timestamps, or uptime readings are included.
- A real network collector must be integrated before automatic discovery or health monitoring is available.
