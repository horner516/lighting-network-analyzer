## v0.1.3 — Device polling and physical port cards

- Adding an IP now requests real device information from the local LAN server; **Poll Nodes** refreshes saved devices.
- Displays reported name, MAC address, firmware identifier, node status and available port/subnet information.
- Replaces inventory rows with compact ProPlex-style port cards and read-only detail dialogs.
- Maps IQ Two physical ports A–P separately from secondary merge inputs and master controls.
- Uses ArtPoll and an IP enquiry with programming disabled; does not change device settings or send lighting output.

**IQ Two limitation:** the tested node's Art-Net reply does not expose current sACN assignments, RDM state or subnet mask. These remain unknown rather than displaying guessed settings. Use the device web page for fields the node does not publish. Live polling requires the local LAN app, not the hosted site.

See [CHANGELOG.md](https://github.com/horner516/lighting-network-analyzer/blob/v0.1.3/CHANGELOG.md) for release history.

### Included from v0.1.2

- Receives and decodes real sACN and Art-Net traffic on the local Windows/Mac server.
- Moves protocol information out of Overview into the **Network** tab.
- Adds **Display current value**: choose a protocol, universe, and channel (1–512) to see DMX values and percentages, refreshed every 0.5 seconds.
- Shows each source separately and clears current values when a stream times out or ends. Zero remains a valid reading.
- Displays active universes, current packets/s, and peak packets/s tracked since server startup.
- Reports multicast subscription limits, missing channels, and unavailable receivers.

sACN multicast defaults to universes 1–64; configure `LNA_SACN_UNIVERSES` for other ranges. Art-Net universes use native 0-based numbering. Live reception requires the local LAN app; the hosted website cannot directly receive your network's UDP traffic.

### Retained from v0.1.1

- Starts with an empty device list. No sample consoles or nodes are included.
- Removes simulated packet rates, graphs, health percentages, interface/subnet, discovery timestamps, and uptime.
- Preserves saved manual entries but labels them **Unverified**, with no invented model, health, or traffic measurements.
- Empty device and details panels clearly explain how to add an IP address.
- The dashboard header displays its version and includes **Check for updates**. It compares the latest public GitHub release and opens GitHub downloads when a newer version is available, with a visible fallback link if popups are blocked.

**Subnet scanning and continuous device-health monitoring are not included.** Added IPs are polled for Art-Net status. Saved device lists are local to each browser.

Download the Windows x64 `.exe`, or the universal Mac `.dmg` for Intel and Apple silicon. The installers include the app and LAN server. Port 47652 is preferred; another port is chosen if it is occupied. The header displays the actual server addresses.

These initial installers are unsigned and the Mac app is not Apple-notarized. Your operating system may display an unknown-publisher warning. Follow your organization's software policy.

Windows users can choose **Check for Updates** from the tray icon to download and install this release. Mac users can use the same menu to check, then download and install the new Mac app from GitHub.

The release includes checksums in SHA256SUMS.txt. Both platforms pass bundled-server tests and packaged startup checks before publication.
