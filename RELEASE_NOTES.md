## v0.1.7 — Lux Link shared inventory and tray host

- Fixed the dashboard update button: the server checks GitHub against its installed version and the browser opens downloads when a newer stable release exists. A visible download link handles popup blocking.
- One server-owned device list is shared by every browser and saved across restarts. A single sequential polling cycle continues in the background, even without a dashboard open.
- New header **Layout** editor: drag device IPs into order, delete devices, undo draft deletions, and save or cancel. Saved changes apply to all viewers. Stale edits are rejected, and deleted devices cannot return through late poll replies or subsequent automatic legacy imports.
- ProPlex protocol selection now comes from read-only `protocol_setup.htm` controls, with status-page fallback. Verified sACN-only and dual Art-Net/sACN configurations.
- Mac starts in the menu bar without a Dock window; Windows starts in the system tray. Choose **Open Browser** to view the dashboard. Update checks and Quit remain available.
- Removed redundant headings and configuration messages. Search, Add by IP and Poll Nodes now align with Overview/Network in a responsive toolbar.
- Green sACN, blue Art-Net and teal dual-mode port accents. Output glow requires explicit reported activity; configuration alone is not evidence of live output or health.
- Existing NETRON API support, physical port cards, sACN/Art-Net listeners, live channel values, peak packet rates and update checks remain available.

**Upgrade note:** browser-local device entries import when that browser first opens the updated LAN server. Entries in the old desktop window's separate profile may need to be added again by IP. Saving a layout closes automatic legacy imports to prevent deleted entries from returning; manual Add by IP remains available.

**LAN access:** run one host and open its displayed IP/port from other devices. Preferred TCP port 47652 automatically moves when occupied. Allow the dashboard port and UDP 5568/6454 on trusted networks. The dashboard has no login: do not expose it to the internet. The hosted website cannot poll LAN nodes or receive lighting UDP; use the local app.

Download the Windows x64 EXE or universal Mac DMG (Apple silicon and Intel). Both include the LAN server; no developer tools are required. Quit the previous app before installing. Installers are unsigned and the Mac app is not notarized; follow your organization's software policy. Windows updates can install after confirmation; Mac updates open GitHub for manual installation.

Automated tests and packaged startup checks run on both platforms before publication. SHA256SUMS.txt contains installer checksums.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.1.7/CHANGELOG.md).
