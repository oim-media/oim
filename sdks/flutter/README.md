# oim_flutter

Native Dart and Flutter SDK for `.oim` interactive images. It reads the file,
verifies its signature and image seal offline, and renders it with the
`OimPlayer` widget. It passes the same conformance vectors as
`@oim-media/player-oim` (`packages/spec/vectors`).

## Install

```bash
flutter pub add oim_flutter
```

Or add it directly in `pubspec.yaml` from [pub.dev](https://pub.dev/packages/oim_flutter).

## Render a file

```dart
import 'package:oim_flutter/oim_flutter.dart';

OimPlayer(
  bytes: fileBytes,          // the whole .oim.png
  language: 'es',            // optional; English when unset
  errorBuilder: (context, error) => const Text('Cannot open this file'),
)
```

Other options: `palette`, `prefersDark`, `allowDynamicColors`, `isInteractive`, `showBaseImage`,
`allowLottie`, `disableAnimations`, and `fontFamily` (the family for text that names
none, like a browser's default font; embedded fonts and named families still win).

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

`test/conformance_test.dart` runs the conformance vectors in `packages/spec/vectors-2` and `packages/spec/vectors`.
Set `OIM_RENDER_OUT=<dir>` to have `test/render_snapshot_test.dart` write a PNG
of each rendered vector.

## License

Apache-2.0. See the repository [LICENSE](../../LICENSE).
