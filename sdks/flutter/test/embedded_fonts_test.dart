// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:oim_flutter/src/ui/embedded_fonts.dart';
import 'package:path/path.dart' as p;

final _woff = File('test/fixtures/bangers-subset.woff').readAsBytesSync();
final _vector = File(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors', 'embedded-font-woff.oim.png')).readAsBytesSync();

void main() {
  test('woff unwraps to a TrueType sfnt with every table', () {
    final sfnt = woffToSfnt(_woff)!;
    expect(sfnt.sublist(0, 4), [0, 1, 0, 0]);
    expect(sfnt.buffer.asByteData().getUint16(4), 17); // Bangers subset: 17 tables
  });

  test('rejects a truncated or foreign file', () {
    expect(woffToSfnt(_woff.sublist(0, 60)), isNull);
    expect(woffToSfnt(_woff.sublist(0, _woff.length - 100)), isNull);
    expect(woffToSfnt(Uint8List.fromList([0x77, 0x4f, 0x46, 0x32, ...List.filled(60, 0)])), isNull); // wOF2
  });

  test('picks the embedded entry of a family closest to the weight', () {
    final fonts = [
      {'family': 'Inter', 'name': 'oim-1-Inter', 'weight': 400, 'style': 'normal', 'format': 'woff'},
      {'family': 'Inter', 'name': 'oim-2-Inter', 'weight': 700, 'style': 'normal', 'format': 'woff'},
      {'family': 'Inter', 'name': 'oim-3-Inter', 'weight': 700, 'style': 'italic', 'format': 'woff'},
      {'family': 'Lora', 'name': 'oim-4-Lora', 'weight': 400, 'style': 'normal', 'format': 'woff2'},
    ];
    expect(embeddedFontName(fonts, 'Inter', 700, 'normal'), 'oim-2-Inter');
    expect(embeddedFontName(fonts, 'Inter', 600, 'normal'), 'oim-2-Inter');
    expect(embeddedFontName(fonts, 'Inter', 400, 'italic'), 'oim-3-Inter');
    expect(embeddedFontName(fonts, 'Lora', 400, 'normal'), isNull); // woff2 is not read here
    expect(embeddedFontName(fonts, 'Roboto', 400, 'normal'), isNull);
  });

  test('a loaded entry changes how text measures', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await loadEmbeddedFonts([
      {'family': 'Bangers', 'name': 'oim-test-Bangers', 'weight': 400, 'style': 'normal', 'format': 'woff', 'data': base64.encode(_woff)},
    ]);
    double width(String family) => (TextPainter(
          text: TextSpan(text: 'Texto regular', style: TextStyle(fontFamily: family, fontSize: 40)),
          textDirection: TextDirection.ltr,
        )..layout())
            .width;
    // The test font paints every glyph as a 40 px square; Bangers does not.
    expect(width('oim-test-Bangers'), isNot(closeTo(width('missing-family'), 1)));
  });

  testWidgets('the vector paints its text in the embedded font', (t) async {
    await t.runAsync(() async {
      await t.pumpWidget(MaterialApp(home: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _vector, showBaseImage: false))));
      await Future<void>.delayed(const Duration(milliseconds: 200));
    });
    await t.pump();
    final rich = t.widgetList<RichText>(find.byType(RichText)).firstWhere((r) => r.text.toPlainText() == 'Fuente incrustada');
    expect(rich.text.style?.fontFamily, startsWith('oim-'));
    expect(rich.text.style?.fontFamily, endsWith('-Inter'));
    // And the player loaded it: the family measures unlike the test font's squares.
    double width(String family) => (TextPainter(
          text: TextSpan(text: 'Fuente incrustada', style: TextStyle(fontFamily: family, fontSize: 40)),
          textDirection: TextDirection.ltr,
        )..layout())
            .width;
    expect(width(rich.text.style!.fontFamily!), isNot(closeTo(width('missing-family'), 1)));
  });
}
