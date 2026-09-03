First standalone desktop release of Lighting Network Analyzer (LUX//LINK).

## Downloads

- **Windows:** choose the `windows-x64.exe` installer (Windows 10 or later, 64-bit).
- **Mac:** choose the `mac-universal.dmg` installer (Intel and Apple silicon). Open the disk image and drag the app into Applications.
- The Mac `.zip` is an alternative download; `.yml` and `.blockmap` files support update checks.

## Included

- Bundled dashboard and LAN server; no Node.js installation required.
- Preferred port 47652, with automatic fallback when busy.
- Clickable server IP addresses and active port in the dashboard header.
- Matching app, installer, and tray/menu-bar icons.
- Close the window to keep the server running; choose Quit from the tray/menu-bar icon to stop it.
- Check for Updates from the tray/menu-bar icon. Windows can download and install updates; this unsigned Mac release opens GitHub for manual installation.

## Before using

**This version displays sample devices. Automatic sACN, Art-Net, and MA device discovery and real health monitoring are not implemented.** Adding a device by IP saves an entry in that browser; it does not probe the device. Each browser has its own saved entries.

These initial installers are not publisher-signed or Apple-notarized. Windows may display a SmartScreen warning. macOS may require opening System Settings → Privacy & Security and approving the app after an initial launch attempt. Follow your organization's software policy; signed releases require signing certificates.

Other devices on the same LAN can use the server address shown in the header. Allow incoming connections on your trusted/private network if the OS firewall prompts. This release has no login; do not expose it to the public internet.

SHA256SUMS.txt contains checksums for the installer downloads. Builds and packaged startup checks run on Windows and macOS before publication.
