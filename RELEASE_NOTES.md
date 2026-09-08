## v0.3.1 — ProPlex universe editing

- **Edit output universes:** supported ProPlex node cards now provide an explicit **Edit ports** mode. Universe fields follow the node's physical port layout and keyboard tab order, and changes remain staged until **Save changes** is pressed.
- **Safe routing updates:** Lux Link reads the complete ProPlex port-routing form, changes only the selected output universes, preserves reported direction, sACN priority and RDM settings, and verifies the node's returned configuration before reporting success.
- **Live hardware verification:** port O and P switching was confirmed on a ProPlex node at `192.168.1.101`; their original universes were restored and verified after the test.
- **Fixtures deferred:** the Fixtures page now explains the planned incomplete-MVR report. MVR upload, fixture test output and RDM control are disabled and excluded from this packaged build.

This release contains one unsigned, non-notarized **macOS Apple silicon** installer. Windows and Intel Mac installers are not produced for v0.3.1. Quit the previous Lux Link app before installing, then drag Lux Link to Applications. If macOS blocks first launch, approve it in System Settings → Privacy & Security according to your organization’s policy.

Changing a node's universe can interrupt live DMX routing. Review every staged port value before saving and make configuration changes only when it is safe for the connected lighting system.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.3.1/CHANGELOG.md).
