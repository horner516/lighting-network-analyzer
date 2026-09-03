## v0.1.5 — Lux Link, ProPlex and NETRON integration

- Renamed the dashboard and desktop app to **Lux Link**, with matching installer names and the existing teal icon. The app identifier and saved browser profile are preserved.
- Added read-only NETRON web API polling, verified on an EN12 running V2.9.2.
- Displays reported firmware, MAC, on-time, subnet mask and port configuration: direction, protocol, universe, effective RDM state, configured frame rate, merge mode and channel range.
- NETRON EN12 ports follow the physical front panel: one compact row, numbered 1–12. ProPlex 16-port cards retain two rows of eight.
- Art-Net tile numbering follows the NETRON web monitor; native addresses remain available in port details.
- Polling failures show explicit warnings. Configuration is not proof of live signal or continuous device health. No simulated devices or readings are included.

**New ProPlex web-monitor support:** reads IQ Two status-page firmware, MAC, subnet mask, direction, universe, protocol, RDM and configured DMX rate. Verified on a real IQ Two 1616. No forms are submitted or settings changed. If unavailable, the app falls back to Art-Net with a warning and preserves unknown fields. Decimal universe format is supported; invalid reported values are flagged. Configuration is not proof of signal or health.

**LAN access:** the server listens on all IPv4 interfaces and displays usable address links for phones, tablets and other computers. Allow the dashboard TCP port on trusted networks; no internet port forwarding is required or recommended.

Live polling and sACN/Art-Net reception require the local Windows/Mac app. The hosted dashboard cannot directly access your LAN. Existing Network features, channel-value viewing, packet-rate peaks and update checks are retained.

Download the Windows x64 EXE or universal Mac DMG (Apple silicon and Intel). Both include the LAN server; no developer tools are required. Port 47652 is preferred, with automatic fallback when occupied. Actual server addresses appear in the header.

The installers are unsigned and the Mac app is not notarized. Follow your organization's software policy. Windows tray updates can download and install after confirmation; Mac updates open GitHub for manual installation. Quit the old Mac app before installing Lux Link.

Checksums are included in SHA256SUMS.txt. Both platform builds run automated tests and packaged startup checks before publication.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.1.5/CHANGELOG.md).
