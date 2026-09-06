## v0.2.2 — Console metadata, reachability and unified polling

- **Poll All Devices:** the global control polls consoles, nodes and switches together. Dedicated Poll Consoles and Poll Nodes controls remain beside their sections.
- **grandMA Web Remote metadata:** the native Mac app reads the console session name, show-file name and session status when a console is added or explicitly polled.
- **Device reachability:** after supported web/API probes fail, Lux Link sends four pings one second apart and displays an explicit online/offline indicator.
- **Simplified receiver streams:** sACN and Art-Net universes are grouped by source device, sequential universes collapse into ranges, and only the selected universe expands its live details.
- **Native Apple-silicon host:** this release keeps the compact menu-bar architecture without Electron or Chromium, including LAN dashboard access, UDP receive/transmit and server-owned device inventory.

This release contains one unsigned, non-notarized **macOS Apple silicon** installer. Windows and Intel Mac installers are not produced for v0.2.2. Quit the previous Lux Link app before installing, then drag Lux Link to Applications. If macOS blocks first launch, approve it in System Settings → Privacy & Security according to your organization’s policy.

Live read-only verification of the new console reader was completed against the grandMA console at `192.168.1.11`, returning session `LITE_4`, show file `Exe summit patch`, and status `IdleMaster`.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.2.2/CHANGELOG.md).
