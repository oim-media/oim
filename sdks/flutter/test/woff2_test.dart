// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/woff2.dart';

Uint8List _fixture(String n) => File('test/fixtures/woff2/$n').readAsBytesSync();

Future<void> _load(String family, Uint8List sfnt) =>
    (FontLoader(family)..addFont(Future.value(ByteData.sublistView(sfnt)))).load();

Future<(double, Uint8List)> _render(String family, String text) async {
  final tp = TextPainter(
    text: TextSpan(text: text, style: TextStyle(fontFamily: family, fontSize: 48, color: const Color(0xFF000000))),
    textDirection: TextDirection.ltr,
  )..layout();
  final rec = ui.PictureRecorder();
  tp.paint(Canvas(rec), Offset.zero);
  final img = await rec.endRecording().toImage(tp.width.ceil() + 2, tp.height.ceil() + 2);
  final px = (await img.toByteData())!.buffer.asUint8List();
  return (tp.width, px);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('anything that is not WOFF2 is refused', () {
    expect(woff2ToSfnt(Uint8List.fromList([1, 2, 3, 4])), isNull);
    expect(woff2ToSfnt(_fixture('fraunces.ttf')), isNull);
  });

  for (final (name, text) in [('fraunces', 'El renacer analógico'), ('pixelify', 'SIEMPRE SIN CONEXIÓN')]) {
    test('$name: the decoded font measures and paints like fontTools\' TTF', () async {
      final sfnt = woff2ToSfnt(_fixture('$name.woff2'));
      expect(sfnt, isNotNull);
      await _load('ref-$name', _fixture('$name.ttf'));
      await _load('dec-$name', sfnt!);
      final ref = await _render('ref-$name', text);
      final dec = await _render('dec-$name', text);
      expect(dec.$1, ref.$1);
      expect(dec.$2, ref.$2);
      // Not the fallback: the fallback test font draws boxes of a fixed width.
      final fallback = await _render('no-such-font', text);
      expect(dec.$1, isNot(fallback.$1));
    });
  }
}
