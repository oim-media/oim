// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/artistic_text.dart';
import 'package:path/path.dart' as p;

final _cases = jsonDecode(File(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'artistic-text-cases.json')).readAsStringSync());

void main() {
  group('artistic text matches the core (artistic-text-cases.json)', () {
    test('curve paths', () {
      for (final c in _cases['curve']) {
        expect(textCurvePathD((c['width'] as num).toDouble(), (c['height'] as num).toDouble(), (c['curveAmount'] as num).toDouble(), c['curveType']), c['d']);
      }
    });
    test('lines', () {
      for (final c in _cases['lines']) {
        final got = artisticTextLines(c['text'], (c['fontSize'] as num).toDouble(), (c['lineHeight'] as num).toDouble());
        expect([for (final l in got) {'text': l.text, 'offset': l.offset}], [for (final l in c['lines']) {'text': l['text'], 'offset': (l['offset'] as num).toDouble()}]);
      }
    });
    test('extrusion layers', () {
      for (final c in _cases['extrusion']) {
        final got = extrusionLayers((c['depth'] as num).toDouble(), (c['angle'] as num).toDouble(), c['color'], c['shading']);
        expect([for (final l in got) [l.dx, l.dy, l.color, l.opacity]],
            [for (final l in c['layers']) [(l['dx'] as num).toDouble(), (l['dy'] as num).toDouble(), l['color'], (l['opacity'] as num).toDouble()]]);
      }
    });
    test('shade', () {
      for (final c in _cases['shade']) {
        expect(shadeHexColor(c['color'], (c['percent'] as num).toDouble()), c['result']);
      }
    });
  });

  // The exporter writes sizes in cqw of the canvas; they are canvas px of the real width.
  test('model reads cqw against the canvas width, px box first', () {
    final m = ArtisticTextModel.fromSlot(
      {'width_px': 800, 'height_px': 220},
      {'fontSize': '13.3333cqw', 'width': '66.6667cqw', 'height': '18.3333cqw', 'extrusionDepth': 18},
      'RETRO', 1200, 'Bangers');
    expect(m.fontSize, closeTo(160, 0.01));
    expect(m.width, 800);
    expect(m.height, 220);
    expect(m.layers.length, 18);
    final n = ArtisticTextModel.fromSlot({}, {'fontSize': '10cqw', 'width': '50cqw', 'height': '20cqw'}, 'A', 1000, 'x');
    expect([n.width, n.height, n.fontSize], [500, 200, 100]);
  });

  testWidgets('paints without errors, straight and curved, with a gradient', (t) async {
    for (final style in [
      <String, dynamic>{'textGradientType': 'sunset-gold', 'extrusionDepth': 6, 'outerStrokeWidth': 2, 'outerStrokeColor': '#000'},
      <String, dynamic>{'curveAmount': 60, 'innerStrokeWidth': 2, 'textGradientType': 'metallic-chrome'},
    ]) {
      final m = ArtisticTextModel.fromSlot({'width_px': 400, 'height_px': 120}, {'fontSize': 48, ...style}, 'UNO\nDOS', 800, 'Roboto');
      await t.pumpWidget(Center(child: SizedBox(width: 400, height: 120, child: artisticTextSlot(m))));
      expect(t.takeException(), isNull);
    }
  });
}
