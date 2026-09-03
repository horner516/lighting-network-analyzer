## v0.1.1 — Remove simulated devices and readings

- Starts with an empty device list. No sample consoles or nodes are included.
- Removes simulated packet rates, graphs, health percentages, interface/subnet, discovery timestamps, and uptime.
- Preserves saved manual entries but labels them **Unverified**, with no invented model, health, or traffic measurements.
- Empty device and details panels clearly explain how to add an IP address.
- The dashboard header displays its version and includes **Check for updates**. It compares the latest public GitHub release and opens GitHub downloads when a newer version is available, with a visible fallback link if popups are blocked.

**Automatic discovery and device health monitoring are not connected yet.** Adding by IP saves an entry in that browser; it does not probe the device or synchronize entries between browsers.

Download the Windows x64 `.exe`, or the universal Mac `.dmg` for Intel and Apple silicon. The installers include the app and LAN server. Port 47652 is preferred; another port is chosen if it is occupied. The header displays the actual server addresses.

These initial installers are unsigned and the Mac app is not Apple-notarized. Your operating system may display an unknown-publisher warning. Follow your organization's software policy.

Windows users can choose **Check for Updates** from the tray icon to download and install this release. Mac users can use the same menu to check, then download and install the new Mac app from GitHub.

The release includes checksums in SHA256SUMS.txt. Both platforms pass bundled-server tests and packaged startup checks before publication.
