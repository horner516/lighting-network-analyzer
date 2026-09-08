## v0.4.0 — Read-only lighting-device discovery

- **Discover Devices:** choose a network adapter and scan for ProPlex/Art-Net nodes, MA Lighting consoles and ETC Eos consoles without entering every IP manually.
- **Review before adding:** results show IP address, reported identity, type and the evidence Lux Link used. Select only the devices you want; existing devices are clearly marked and cannot be duplicated.
- **Two discovery levels:** the standard scan uses Art-Net discovery and recognizable MA/ETC sACN sources. The optional Deep scan checks only the selected adapter's `/24` for supported web and OSC services, which helps locate silent consoles.
- **Read-only design:** discovery never sends lighting output, changes node configuration, sends OSC commands, joins an MA session or adds a result automatically.
- **Shared inventory:** discovered devices are saved by the LAN server and appear in every browser connected to that Lux Link server.

This build contains one unsigned, non-notarized **macOS Apple silicon** installer. Windows and Intel Mac installers are not produced for v0.4.0. Quit the previous Lux Link app before installing, then drag Lux Link to Applications. If macOS blocks first launch, approve it in System Settings → Privacy & Security according to your organization's policy.

Discovery is limited to networks directly reachable through the selected adapter. VLAN boundaries, client isolation, firewall rules and disabled vendor services may prevent results. Deep scan is intentionally limited to a `/24`; Add by IP remains available for routed devices.

Changing a node's universe can interrupt live DMX routing. Review every staged port value before saving and make configuration changes only when it is safe for the connected lighting system.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.4.0/CHANGELOG.md).
