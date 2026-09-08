## v0.3.2 — Console detection and live channel visibility

- **ETC and MA console detection:** console polling now selects the appropriate read-only path. ETC Eos devices are detected through their documented OSC TCP service and no longer wait for MA Web Remote metadata.
- **Live ProPlex port states:** configured output ports are correlated with Lux Link's receiver. Ports with matching DMX remain protocol-colored; observable sACN universes without current data show a red universe and **NO DATA**, following ProPlex Manager.
- **All 512 channel values:** expanded Network stream details now show 16 live values at a time. Previous/Next controls and a range slider navigate channels 1–512 without enlarging every receiver snapshot.
- **ProPlex universe editing retained:** supported output-universe edits remain staged, preserve the node's other routing fields, and are verified after saving.
- **Fixtures deferred:** MVR upload, fixture test output and RDM control remain disabled in this packaged build.

This release contains one unsigned, non-notarized **macOS Apple silicon** installer. Windows and Intel Mac installers are not produced for v0.3.2. Quit the previous Lux Link app before installing, then drag Lux Link to Applications. If macOS blocks first launch, approve it in System Settings → Privacy & Security according to your organization’s policy.

Changing a node's universe can interrupt live DMX routing. Review every staged port value before saving and make configuration changes only when it is safe for the connected lighting system.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.3.2/CHANGELOG.md).
