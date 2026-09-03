# Lighting Network Analyzer

Standalone desktop and web dashboard for monitoring lighting network devices (sACN, Art-Net, grandMA, ETC, TMB ProPlex, Obsidian/NETRON).

## Downloads

**Installers are not published yet.** The links below open GitHub Releases, where Windows and Mac downloads will appear after the first desktop release is built and uploaded.

| Platform | Download location | File to choose under Assets |
| --- | --- | --- |
| Windows | [Windows downloads](https://github.com/horner516/lighting-network-analyzer/releases) | Windows `.exe` installer |
| macOS | [Mac downloads](https://github.com/horner516/lighting-network-analyzer/releases) | `.dmg` for your Mac (Apple silicon: `arm64`; Intel: `x64`) |

GitHub's automatic **Source code** downloads are not installable apps. Until installers are published, use the local build instructions below.

## What this repo contains

- React dashboard (`app/`) with discovered-device panel and health views
- LAN server helpers in `scripts/start-lan.mjs`
- Windows desktop host in `electron/main.cjs`
- Auto-update capable Windows packaging settings (`electron-builder.json`)

## Prerequisites

- Node.js 22+
- pnpm

## Start the web app for LAN use

By default, the app uses port **47652** (high-numbered port to reduce service conflicts).

```bash
cd /path/to/lighting-analyzer
pnpm install
pnpm run start:lan
```

The server binds to `0.0.0.0` so other devices on your subnet can open:

`http://<server-ip>:47652`

You can override:

```bash
NETWORK_ANALYZER_PORT=50000 NETWORK_ANALYZER_HOST=0.0.0.0 pnpm run start:lan
```

## Windows desktop app (EXE)

The desktop mode runs the same LAN server and opens an Electron window.

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

## Build EXE locally

```bash
pnpm install
pnpm run desktop:build
```

Artifacts appear in `desktop-dist/`.

Build on Windows for the Windows installer. On a Mac, `pnpm run desktop:build` produces macOS `.dmg` and `.zip` packages for the build machine's architecture. Windows installer, uninstaller, shortcuts, and the Mac app use matching icons derived from `public/app-icon.svg`.

## Updates

The desktop app checks `https://github.com/horner516/lighting-network-analyzer` for new GitHub releases (with a matching tag/version) and can install downloaded releases directly.

## Deployment

The page now shows the active access URL at the top of the dashboard header and links to the running server (`protocol://host:port`).

## Important notes

- The current build is a demo dataset for layout/testing unless you connect a real discovery backend.
- If you want the page to display real discovery data, wire the device list to your discovery API/socket feed instead of the static `devices` sample array.
