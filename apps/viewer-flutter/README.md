# OIM viewer (Flutter)

A native viewer for `.oim` files on Android, iOS and Windows, built on the
[`oim_flutter`](../../sdks/flutter/README.md) SDK. It opens a file, verifies its
signature offline and plays its layers.

## Run

```bash
cd apps/viewer-flutter
flutter pub get
flutter run
```

## Release builds

The `release` workflow builds them on every `v*` tag:

| Platform | Command | Output |
|---|---|---|
| Android | `flutter build apk --release` | `build/app/outputs/flutter-apk/app-release.apk` |
| Windows | `flutter build windows --release` | `build/windows/x64/runner/Release/` |
| iOS | `flutter build ios --release --no-codesign` | an unsigned IPA |

The iOS build is unsigned: sign it with your own certificate to install it.

## License

Apache-2.0. See the repository [LICENSE](../../LICENSE).
