## v0.3.3 — Console detection hotfix

- **Console polling fixed:** the LAN server now preserves the saved Console device type when handing a new device to the poller, allowing vendor detection to select ETC Eos or MA Web Remote correctly.
- **Clearer pending status:** console cards display **Detecting Console Info** while their first read-only poll is running.
- **Live validation:** ETC Eos detection was verified against consoles at `192.168.1.5` and `192.168.1.6`, both responding on OSC TCP 3032.
- **Existing 0.3.2 features retained:** live ProPlex port states, 512-channel Network value navigation, ProPlex universe editing and vendor-aware console display remain included.

This build contains one unsigned, non-notarized **macOS Apple silicon** installer. Windows and Intel Mac installers are not produced for v0.3.3. Quit the previous Lux Link app before installing, then drag Lux Link to Applications. If macOS blocks first launch, approve it in System Settings → Privacy & Security according to your organization’s policy.

Changing a node's universe can interrupt live DMX routing. Review every staged port value before saving and make configuration changes only when it is safe for the connected lighting system.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.3.3/CHANGELOG.md).
