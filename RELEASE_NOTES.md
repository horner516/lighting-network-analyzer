## v0.3.0 — MVR fixture import and test output

- **Fixtures workspace:** upload an MVR to the shared Lux Link server and browse fixtures grouped by manufacturer, model and GDTF mode.
- **Profile-aware mapping:** embedded GDTF definitions provide intensity, shutter, RGB, 16-bit pan/tilt and gobo channel mappings. Unsupported or ambiguous modes stay visible and are never guessed.
- **Multi-universe tests:** select fixture types and transmit 100% output, an RGB sweep, a reversing pan circle, a repeating tilt test, or one-second Gobo Wheel 1/2 steps with profile-defined rotation when available.
- **sACN and Art-Net:** choose either output protocol and set sACN priority from 0–200. Lux Link reports priority as unavailable for Art-Net because standard ArtDmx has no priority field.
- **Safety controls:** every test shows its supported fixture count, active configuration is locked until output stops, and Stop all tests sends final blackout frames before disabling the fixture-test transmitter.

This release contains one unsigned, non-notarized **macOS Apple silicon** installer. Windows and Intel Mac installers are not produced for v0.3.0. Quit the previous Lux Link app before installing, then drag Lux Link to Applications. If macOS blocks first launch, approve it in System Settings → Privacy & Security according to your organization’s policy.

Fixture tests transmit real DMX and may illuminate or move equipment. Confirm the selected network connection, clear the performance area, and use a priority appropriate for the system before enabling a test.

See the [changelog](https://github.com/horner516/lighting-network-analyzer/blob/v0.3.0/CHANGELOG.md).
