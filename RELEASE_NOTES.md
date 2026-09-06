## v0.2.1 — Lux Link devices, console foundation and native Mac host

- **Devices replaces Overview**, with separate Console, Nodes and Switches tabs. The selected type belongs to the shared server inventory, so every browser sees the same organization.
- **grandMA foundation:** consoles are identified through MA Web Remote on TCP 8080. Console cards show active sACN and Art-Net universes observed from that console IP, including received sACN priority. MA session name and membership are shown as not reported because the verified Web Remote landing page does not expose them.
- **Network adapter selection:** choose the local IPv4 connection used for both receive and transmit. Switching connections stops any active transmitter and restarts the listeners safely.
- **Transmit controls:** send one sACN or Art-Net universe, set a single channel, set all 512 values to 50% (DMX 128), and select sACN priority from 0–200. Output remains disabled on startup.
- **Smaller Mac app:** Electron and its bundled Chromium engine have been removed from the release. A native Swift menu-bar host runs the same local LAN server using a bundled Apple-silicon Node runtime. The resulting DMG is approximately 43 MB while retaining device polling, UDP I/O, shared browser access and update checks.

This release contains one unsigned, non-notarized **macOS Apple silicon** installer. Windows and Intel Mac installers are not produced for v0.2.1. Quit the previous Lux Link app before installing, then drag Lux Link to Applications. If macOS blocks first launch, approve it in System Settings → Privacy & Security according to your organization’s policy.

Live read-only verification was completed against the ProPlex node at `192.168.1.101` (IQ Two 1616 2X, 16 ports) and the grandMA console at `192.168.1.11` (MA Web Remote responding on port 8080).

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.2.1/CHANGELOG.md).
