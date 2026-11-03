// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Renders every conformance vector with OimPlayer to a PNG so the output can be
// looked at. Output goes to the directory in OIM_RENDER_OUT (skipped if unset).
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:path/path.dart' as p;

void main() {
  final out = Platform.environment['OIM_RENDER_OUT'];
  final vectors = Directory(p.normalize(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors')))
      .listSync()
      .where((f) => f.path.endsWith('.oim.png'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  for (final v in vectors) {
    final name = p.basename(v.path).replaceAll('.oim.png', '');
    testWidgets('render $name', (tester) async {
      // flutter_test turns shadows into hard-edged ones by default; we want to see the real blur.
      if (out != null) debugDisableShadows = false;
      final key = GlobalKey();
      final bytes = File(v.path).readAsBytesSync();
      await tester.binding.setSurfaceSize(const Size(900, 700));
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: const Color(0xFF202020),
          body: Center(
            child: RepaintBoundary(
              key: key,
              child: SizedBox(width: 800, child: OimPlayer(bytes: bytes)),
            ),
          ),
        ),
      ));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
      await tester.pump(const Duration(milliseconds: 200));
      if (out == null) return;
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1.0);
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        Directory(out).createSync(recursive: true);
        File(p.join(out, '$name.png')).writeAsBytesSync(data!.buffer.asUint8List());
      });
      // The test binding asserts this is back to its default before the test ends.
      debugDisableShadows = true;
    });
  }
}
