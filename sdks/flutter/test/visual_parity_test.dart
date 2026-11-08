// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Visual conformance adapter: renders every conformance vector under the procedure
// of CANONICAL_SPEC.md ("Visual conformance") to build/parity/flutter/<vector>.png.
// It does not compare; packages/spec/tools/parity.mjs does. Runs only with OIM_PARITY=1.
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:path/path.dart' as p;

const _width = 800;

void _collectFamilies(Object? node, Set<String> into) {
  if (node is Map) {
    final family = node['fontFamily'];
    if (family is String && family.isNotEmpty) into.add(family);
    node.values.forEach((v) => _collectFamilies(v, into));
  } else if (node is List) {
    node.forEach((v) => _collectFamilies(v, into));
  }
}

// flutter_test has only the Ahem test font (boxes). The browser resolves a family it
// lacks through fontconfig, so each family the vectors name is registered with the
// file fontconfig picks for it (first entry of a CSS stack). Embedded fonts still win:
// the player registers them under their own names.
Future<void> _loadSystemFonts(Iterable<File> vectors) async {
  final families = <String>{'sans-serif', 'serif'};
  for (final v in vectors) {
    _collectFamilies(extractOIM(v.readAsBytesSync()).metadata, families);
  }
  for (final family in families) {
    final first = family.split(',').first.trim().replaceAll(RegExp('["\']'), '');
    // The bold face too: the browser asks fontconfig for the weight it needs, so a bold layer gets the real bold file.
    final loader = FontLoader(family);
    final seen = <String>{};
    for (final pattern in [first, '$first:bold']) {
      final result = await Process.run('fc-match', ['-f', '%{file}', pattern]);
      final file = File(result.stdout.toString());
      if (!file.existsSync() || !seen.add(file.path)) continue;
      loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
    }
    if (seen.isNotEmpty) await loader.load();
  }
}

void main() {
  if (Platform.environment['OIM_PARITY'] != '1') return;
  // OIM_VECTORS renders any folder of works (e.g. real files) instead of the conformance vectors.
  final spec = Platform.environment['OIM_VECTORS'] ?? p.normalize(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors'));
  final out = p.join(Directory.current.path, 'build', 'parity', 'flutter');
  final vectors = Directory(spec).listSync().where((f) => f.path.endsWith('.oim.png')).toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  setUpAll(() => _loadSystemFonts(vectors.cast<File>()));

  for (final v in vectors) {
    final name = p.basename(v.path).replaceAll('.oim.png', '');
    testWidgets('parity render $name', (tester) async {
      debugDisableShadows = false;
      final bytes = File(v.path).readAsBytesSync();
      // Same size rule as the web goldens: 800 wide, height from the vector's PNG header.
      final header = ByteData.sublistView(bytes);
      final height = (_width * header.getUint32(20) / header.getUint32(16)).round();
      final key = GlobalKey();
      await tester.binding.setSurfaceSize(Size(_width.toDouble(), height.toDouble()));
      await tester.pumpWidget(MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: RepaintBoundary(
            key: key,
            child: ColoredBox(
              color: const Color(0xFFFFFFFF),
              child: SizedBox(width: _width.toDouble(), height: height.toDouble(), child: OimPlayer(bytes: bytes, fontFamily: 'sans-serif')),
            ),
          ),
        ),
      ));
      // Let images and embedded fonts decode, as the web waits for load.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 500)));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.runAsync(() async {
        final image = await (key.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage(pixelRatio: 1.0);
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        Directory(out).createSync(recursive: true);
        File(p.join(out, '$name.png')).writeAsBytesSync(data!.buffer.asUint8List());
      });
      debugDisableShadows = true;
      await tester.binding.setSurfaceSize(null);
    });
  }
}
