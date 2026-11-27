// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:path/path.dart' as p;

void main() {
  final v2Dir = Directory(p.normalize(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors-2')));
  final vectors = v2Dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.oim.png'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  test('all 2.0 vectors extract, verify, and normalize', () {
    expect(vectors.length, greaterThanOrEqualTo(40));
    for (final f in vectors) {
      final name = p.basename(f.path);
      final bytes = f.readAsBytesSync();
      final res = extractOIM(bytes);
      expect(isV2Document(res.metadata), isTrue, reason: '$name should be v2');
      final status = verifyOim(res);
      expect(isRefused(status), isFalse, reason: '$name verification failed: $status');

      final normalized = normalizeV2Metadata(res.metadata);
      expect(normalized['canvas'], isA<Map>());
      expect((normalized['canvas']['natural_width'] as num), greaterThan(0));
      expect((normalized['canvas']['natural_height'] as num), greaterThan(0));
      expect(normalized['slots'], isA<List>(), reason: '$name missing normalized slots');
      expect(oimLanguages(res.metadata), isA<List<String>>());
    }
  });

  test('v2 adapter maps blend, artistic strokes/gradient, pattern roles, shadows, and presets', () {
    final normalized = normalizeV2Metadata({
      'oim': '2.0.0-draft.1',
      'canvas': {'width': 800, 'height': 600},
      'variables': {
        'defaults': {'palette': 'dark'},
        'values': {
          'accent': {'dark': '#a3e635', 'light': '#4d7c0f'},
          'surface': {'dark': '#18181b', 'light': '#fafafa'},
        },
      },
      'layers': [
        {
          'id': 'background-pattern-slot',
          'type': 'shape',
          'box': {'x': 0, 'y': 0, 'width': 800, 'height': 600},
          'geometry': {'kind': 'rect'},
          'fills': [
            {
              'kind': 'pattern',
              'pattern': {
                'preset': 'dots',
                'bg': {'var': 'surface', 'fallback': '#18181b'},
                'colors': [
                  {'var': 'accent', 'fallback': '#a3e635'}
                ],
              },
            },
          ],
        },
        {
          'id': 'blend-card',
          'type': 'shape',
          'blend': 'multiply',
          'box': {'x': 40, 'y': 40, 'width': 200, 'height': 200},
          'geometry': {'kind': 'preset', 'name': 'star'},
          'effects': [
            {'kind': 'shadow', 'x': 0, 'y': 8, 'blur': 15, 'opacity': 0.4, 'color': '#000000'},
          ],
        },
        {
          'id': 'star-cut',
          'type': 'shape',
          'box': {'x': 250, 'y': 150, 'width': 300, 'height': 300},
          'geometry': {'kind': 'preset', 'name': 'star'},
          'mask': {'mode': 'cutout'},
        },
        {
          'id': 'title',
          'type': 'text',
          'box': {'x': 0, 'y': 0, 'width': 400, 'height': 120},
          'fills': [
            {'kind': 'gradient', 'preset': 'sunset-gold'},
            {'kind': 'color', 'value': '#fde047'},
          ],
          'strokes': [
            {'align': 'outside', 'width': 4, 'paint': {'kind': 'color', 'value': '#1e1b4b'}},
            {'align': 'inside', 'width': 1, 'paint': {'kind': 'color', 'value': '#ffffff'}},
          ],
          'text': {
            'content': {'es': 'Hola'},
            'artistic': {'preset': 'retro-wave-3d'},
          },
        },
      ],
    });
    final slots = (normalized['slots'] as List).cast<Map<String, dynamic>>();
    final bg = slots.firstWhere((s) => s['id'] == 'background-pattern-slot');
    expect(bg['is_background_pattern'], isTrue);
    expect(bg['style']['backgroundType'], 'pattern');
    expect(bg['style']['fillPatternBgColorRole'], 'surface');
    expect(bg['style']['fillPatternColorRole'], 'accent');
    expect(bg['style']['fillPatternColors'], ['#a3e635']);

    final card = slots.firstWhere((s) => s['id'] == 'blend-card');
    expect(card['style']['v2Blend'], 'multiply');
    expect(card['style']['svgPath'], isNotNull);
    expect(card['style']['svgViewBox'], '0 0 100 100');
    expect(card['style']['geoShape'], isNull);
    final effect = (card['style']['effects'] as List).first as Map;
    expect(effect['opacity'], 0.4);
    expect(effect['enabled'], isTrue);

    final title = slots.firstWhere((s) => s['id'] == 'title');
    final mask = slots.firstWhere((s) => s['id'] == 'star-cut');
    expect(mask['type'], 'mask');
    expect(mask['style']['maskSvgPath'], startsWith('M50 -3.33'));
    expect(title['style']['textGradientType'], 'sunset-gold');
    expect(title['style']['fillColor'], '#fde047');
    expect(title['style']['outerStrokeColor'], '#1e1b4b');
    expect(title['style']['outerStrokeWidth'], 4);
    expect(title['style']['innerStrokeColor'], '#ffffff');
    expect(title['style']['innerStrokeWidth'], 1);
  });

  for (final sample in const ['basic-text', 'artistic-text', 'filter-effects', 'crop', 'flip']) {
    testWidgets('OimPlayer renders 2.0 vector $sample without error', (tester) async {
      final file = File(p.join(v2Dir.path, '$sample.oim.png'));
      expect(file.existsSync(), isTrue);
      final bytes = file.readAsBytesSync();

      await tester.binding.setSurfaceSize(const Size(900, 700));
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: Center(
            child: SizedBox(width: 800, child: OimPlayer(bytes: bytes, disableAnimations: true)),
          ),
        ),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.byType(OimPlayer), findsOneWidget);
    });
  }

  test('a rotated group pivots on its box centre; an icon path keeps its own stroke', () {
    final n = normalizeV2Metadata({
      'oim': '2.0.0-draft.1',
      'canvas': {'width': 1200, 'height': 900},
      'layers': [
        {
          'id': 'g', 'type': 'group',
          'box': {'x': 680, 'y': 360, 'width': 140, 'height': 160, 'rotation': 270},
          'children': [
            {'id': 'a', 'type': 'shape', 'geometry': {'kind': 'rect'}, 'box': {'x': 680, 'y': 360, 'width': 140, 'height': 60}},
          ],
        },
        {
          'id': 'i', 'type': 'shape',
          'geometry': {'kind': 'paths', 'viewBox': [0, 0, 24, 24], 'paths': [{'d': 'M0 0L24 24', 'stroke': '#ffffff', 'strokeWidth': 2}]},
          'box': {'x': 0, 'y': 0, 'width': 120, 'height': 120},
        },
      ],
    });
    final slots = (n['slots'] as List).cast<Map<String, dynamic>>();
    final g = slots.firstWhere((s) => s['id'] == 'g')['style'] as Map;
    expect(g['rotationPivot'], [750 / 1200 * 100, 440 / 900 * 100]);
    final icon = slots.firstWhere((s) => s['id'] == 'i')['style'] as Map;
    expect(icon['strokeColor'], '#ffffff');
    expect(icon['strokeWidth'], 10);
  });
}
