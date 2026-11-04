# oim_flutter

Native Dart and Flutter SDK for `.oim` interactive images. It reads the file,
verifies its signature and image seal offline, and renders it with the
`OimPlayer` widget. It passes the same conformance vectors as
`@oim-media/player-oim` (`packages/spec/vectors`).

## Install

Not on pub.dev yet. Depend on it from this repository:

```yaml
dependencies:
  oim_flutter:
    git:
      url: https://github.com/oim-media/oim.git
      path: sdks/flutter
```

## Render a file

```dart
import 'package:oim_flutter/oim_flutter.dart';

OimPlayer(
  bytes: fileBytes,          // the whole .oim.png
  language: 'es',            // optional; English when unset
  errorBuilder: (context, error) => const Text('Cannot open this file'),
)
```

Other options: `palette`, `prefersDark`, `isInteractive`, `showBaseImage`,
`allowLottie`, `disableAnimations`.

## Read and verify without rendering

```dart
final result = extractOIM(fileBytes);
final status = verifyOim(result);   // OimSecurityStatus
if (isRefused(status)) {
  // altered file: show neither its image nor its layers
}
final permission = permissionOf(result.metadata); // reedit permission
```

`OimSecurityStatus` uses the same vocabulary as the web player, plus
`unknownKey`: the SDK never contacts a server, so a `key_version` it does not
carry is reported instead of fetched. Files written with the legacy Spanish
`reedicion` key are read the same as `reedit`.

## Test

```bash
flutter test
```

`test/conformance_test.dart` runs every vector in `packages/spec/vectors`.
Set `OIM_RENDER_OUT=<dir>` to have `test/render_snapshot_test.dart` write a PNG
of each rendered vector.

## License

Apache-2.0. See the repository [LICENSE](../../LICENSE).
