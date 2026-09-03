# Lighting Network Analyzer

Standalone desktop and web dashboard for monitoring lighting network devices (sACN, Art-Net, grandMA, ETC, TMB ProPlex, Obsidian/NETRON).

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

- Tray icon (uses the web app favicon icon)
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

## Updates

The desktop app checks `https://github.com/horner516/lighting-network-analyzer` for new GitHub releases (with a matching tag/version) and can install downloaded releases directly.

## Deployment

The page now shows the active access URL at the top of the dashboard header and links to the running server (`protocol://host:port`).

## Important notes

- The current build is a demo dataset for layout/testing unless you connect a real discovery backend.
- If you want the page to display real discovery data, wire the device list to your discovery API/socket feed instead of the static `devices` sample array.
