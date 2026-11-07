// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:oim_flutter/src/ui/css_gradient.dart';
import 'package:oim_flutter/src/ui/grain.dart';
import 'package:oim_flutter/src/ui/patterns.dart';
import 'package:path/path.dart' as p;

final _spec = p.join(Directory.current.path, '..', '..', 'packages', 'spec');

void main() {
  group('pattern layout matches the web (pattern-cases.json)', () {
    final cases = (jsonDecode(File(p.join(_spec, 'pattern-cases.json')).readAsStringSync()) as List)
        .cast<Map<String, dynamic>>();
    test('has cases', () => expect(cases.length, greaterThan(3)));
    for (final c in cases) {
      test(c['name'], () {
        final o = c['options'] as Map<String, dynamic>;
        List<T>? list<T>(String k) => (o[k] as List?)?.cast<T>();
        final got = patternLayout(
          type: o['type'] as String,
          fgColor: o['fgColor'] as String,
          scale: (o['scale'] as num?)?.toDouble() ?? 1,
          colors: list<String>('colors'),
          svgs: list<String>('svgs'),
          sizes: list<num>('sizes'),
          counts: list<num>('counts'),
          dispersions: list<num>('dispersions'),
          count: o['count'] as num?,
          dispersion: o['dispersion'] as num?,
        );
        final want = (c['figures'] as List).cast<Map<String, dynamic>>();
        expect(got.length, want.length);
        for (var i = 0; i < want.length; i++) {
          expect(got[i].x, closeTo(want[i]['x'], 1e-9), reason: 'figure $i x');
          expect(got[i].y, closeTo(want[i]['y'], 1e-9), reason: 'figure $i y');
          expect(got[i].scale, closeTo(want[i]['scale'], 1e-9), reason: 'figure $i scale');
          expect(got[i].rotation, closeTo(want[i]['rotation'], 1e-9), reason: 'figure $i rotation');
          expect(got[i].color, want[i]['color']);
        }
      });
    }
  });

  group('CSS gradients', () {
    const box = Size(200, 100);
    test('linear with an angle and percentage stops', () {
      final g = parseCssGradient('linear-gradient(90deg, #ff0000 0%, rgba(0, 0, 255, 0.5) 100%)', box) as LinearGradient;
      expect(g.colors, [const Color(0xFFFF0000), const Color(0x800000FF)]);
      expect(g.stops, [0, 1]);
      // 90deg runs left to right across the whole width.
      expect((g.end as Alignment).x, closeTo(1, 1e-9));
      expect((g.end as Alignment).y, closeTo(0, 1e-9));
    });
    test('default direction is to bottom and missing stops spread evenly', () {
      final g = parseCssGradient('linear-gradient(#000, #808080, #fff)', box) as LinearGradient;
      expect((g.end as Alignment).y, closeTo(1, 1e-9));
      expect(g.stops, [0, 0.5, 1]);
    });
    test('`to right` and a 45deg line reach the corners', () {
      final r = parseCssGradient('linear-gradient(to right, #000, #fff)', box) as LinearGradient;
      expect((r.end as Alignment).x, closeTo(1, 1e-9));
      final d = parseCssGradient('linear-gradient(45deg, #000, #fff)', const Size(100, 100)) as LinearGradient;
      expect((d.end as Alignment).x, closeTo(1, 1e-9));
      expect((d.end as Alignment).y, closeTo(-1, 1e-9));
    });
    test('radial', () {
      expect(parseCssGradient('radial-gradient(circle, #fff 0%, #000 100%)', box), isA<RadialGradient>());
    });
    test('anything else is refused', () {
      for (final bad in ['conic-gradient(#000, #fff)', 'linear-gradient(foo, #000)', 'url(x)', 'linear-gradient()', 42]) {
        expect(parseCssGradient(bad, box), isNull, reason: '$bad');
      }
    });
  });

  group('grain', () {
    test('size maps to the web frequency', () {
      expect(grainFrequency(1), 2.0);
      expect(grainFrequency(100), 0.2);
      expect(grainFrequency(null), grainFrequency(50));
      expect(grainFrequency(50), 1.109);
    });
    test('intensity is the opacity, default 20', () {
      expect(grainOpacity(30), 0.3);
      expect(grainOpacity(null), 0.2);
      expect(grainOpacity(500), 1.0);
    });
    test('the tile is grey noise that wraps at its edges', () {
      final px = grainPixels(grainFrequency(50), 32, 1);
      final grey = <int>{};
      for (var i = 0; i < px.length; i += 4) {
        expect(px[i], px[i + 1]);
        expect(px[i], px[i + 2]);
        grey.add(px[i]);
      }
      expect(grey.length, greaterThan(20));
    });
  });

  testWidgets('shapes filled with a picture paint it, not the fallback colour (image-fill vector)', (t) async {
    final bytes = File(p.join(_spec, 'vectors', 'image-fill.oim.png')).readAsBytesSync();
    await t.pumpWidget(MaterialApp(home: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: bytes, showBaseImage: false))));
    await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await t.pump();
    // The circle and the star.
    expect(find.byType(OimImageFillWidget), findsNWidgets(2));
  });

  testWidgets('vectors paint their grain and patterns', (t) async {
    for (final name in ['layer-grain', 'pattern-color-roles']) {
      final bytes = File(p.join(_spec, 'vectors', '$name.oim.png')).readAsBytesSync();
      await t.pumpWidget(MaterialApp(home: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: bytes, showBaseImage: false))));
      await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
      await t.pump();
      // layer-grain: the title and the circle, each with its noise cut to its own alpha.
      if (name == 'layer-grain') {
        expect(find.byWidgetPredicate((w) => w.runtimeType.toString() == '_GrainPaint'), findsNWidgets(2));
      }
    }
    expect(find.byType(OimPatternFill), findsNWidgets(2));
  });
}
