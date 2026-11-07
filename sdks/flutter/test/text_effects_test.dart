// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:oim_flutter/src/ui/text_animation.dart';
import 'package:oim_flutter/src/ui/text_effects.dart';
import 'package:path/path.dart' as p;

final _spec = p.join(Directory.current.path, '..', '..', 'packages', 'spec');
dynamic _load(String f) => jsonDecode(File(p.join(_spec, f)).readAsStringSync());

void main() {
  group('marks match the web (marks-cases.json)', () {
    final cases = (_load('marks-cases.json') as List).cast<Map<String, dynamic>>();
    for (final c in cases) {
      test(c['name'], () {
        final known = (c['known'] as List).cast<String>();
        final runs = parseMarks(c['text'], known);
        if (c['runs'] != null) {
          expect([for (final r in runs) {'text': r.text, if (r.mark != null) 'mark': r.mark}], c['runs']);
        }
        if (c['plain'] != null) expect(plainText(c['text'], known), c['plain']);
      });
    }
  });

  group('text effects match the web (text-effect-cases.json)', () {
    final d = _load('text-effect-cases.json') as Map<String, dynamic>;
    test('wave period', () => expect(wavePeriod, closeTo(d['wavePeriod'], 1e-12)));
    test('entrance frames', () {
      for (final c in (d['entrance'] as List).cast<Map<String, dynamic>>()) {
        final f = entranceFrameAt(c['effect'], (c['t'] as num).toDouble(), c['index'], (c['stagger'] as num).toDouble(), (c['delay'] as num).toDouble());
        final w = c['frame'] as Map<String, dynamic>;
        final why = '${c['effect']} t=${c['t']}';
        expect(f.opacity, closeTo(w['opacity'], 1e-9), reason: why);
        expect(f.translateYEm, closeTo(w['translateYEm'], 1e-9), reason: why);
        expect(f.scale, closeTo(w['scale'], 1e-9), reason: why);
        expect(f.rotateDeg, closeTo(w['rotateDeg'], 1e-9), reason: why);
      }
    });
    test('entrance units', () {
      for (final c in (d['units'] as List).cast<Map<String, dynamic>>()) {
        expect(entranceUnits(c['text'], c['effect']), c['units'], reason: c['effect']);
      }
    });
    test('glitch layers', () {
      for (final c in (d['glitch'] as List).cast<Map<String, dynamic>>()) {
        final g = glitchLayersAt(c['type'], (c['t'] as num).toDouble(), (c['speed'] as num).toDouble(), (c['delay'] as num).toDouble(), (c['intensity'] as num).toDouble());
        final w = c['layers'] as Map<String, dynamic>;
        final why = '${c['type']} t=${c['t']}';
        expect(g.skewX, closeTo(w['skewX'], 1e-9), reason: why);
        final copies = (w['copies'] as List).cast<Map<String, dynamic>>();
        expect(g.copies.length, copies.length);
        for (var i = 0; i < copies.length; i++) {
          expect(g.copies[i].dx, closeTo(copies[i]['dx'], 1e-9), reason: why);
          expect(g.copies[i].dy, closeTo(copies[i]['dy'], 1e-9), reason: why);
          expect(g.copies[i].opacity, closeTo(copies[i]['opacity'], 1e-9), reason: why);
          expect(g.copies[i].color, copies[i]['color'], reason: why);
          final clip = copies[i]['clip'] as Map<String, dynamic>?;
          if (clip != null) {
            expect(g.copies[i].clipTop, closeTo(clip['top'], 1e-9), reason: why);
            expect(g.copies[i].clipBottom, closeTo(clip['bottom'], 1e-9), reason: why);
          }
        }
      }
    });
    test('typewriter', () {
      for (final c in (d['typewriter'] as List).cast<Map<String, dynamic>>()) {
        final s = typewriterAt(c['text'], (c['t'] as num).toDouble(), (c['speed'] as num).toDouble(), (c['delay'] as num).toDouble(), c['cursor']);
        expect(s.visible, c['state']['visibleText'], reason: 't=${c['t']}');
        expect(s.cursor, c['state']['showCursor'], reason: 't=${c['t']}');
      }
    });
    test('wave start', () {
      for (final c in (d['wave'] as List).cast<Map<String, dynamic>>()) {
        expect(waveStart(c['index'], (c['speed'] as num).toDouble(), (c['delay'] as num).toDouble()), closeTo(c['start'], 1e-12));
      }
    });
  });

  testWidgets('marks paint their style and the tags disappear', (t) async {
    await t.pumpWidget(MaterialApp(
      home: markedText('a {b}bold{/b} {h}hl{/h}', {
        'b': {'bold': true, 'color': '#ff0000'},
        'h': {'highlight': {'style': 'pill'}},
      }, const TextStyle(), null, (s) => s.toUpperCase()),
    ));
    final rich = t.widget<RichText>(find.byType(RichText)).text as TextSpan;
    expect(rich.toPlainText(), 'A BOLD HL');
    final spans = (rich.children!.single as TextSpan).children!.cast<TextSpan>();
    expect(spans[1].style!.fontWeight, FontWeight.w700);
    expect(spans[1].style!.color, const Color(0xFFFF0000));
    expect(spans[3].style!.backgroundColor, const Color(0x59F59E0B));
  });

  testWidgets('typewriter types and glitch draws its copies', (t) async {
    await t.pumpWidget(const MaterialApp(home: OimTextAnimation(text: 'Hola', style: TextStyle(), type: 'typewriter', speed: 10)));
    expect((t.widget<RichText>(find.byType(RichText)).text as TextSpan).toPlainText(), '|');
    await t.pump(const Duration(milliseconds: 250));
    expect((t.widget<RichText>(find.byType(RichText)).text as TextSpan).toPlainText(), 'Ho|');
    await t.pumpWidget(const MaterialApp(home: OimTextAnimation(key: ValueKey('g'), text: 'X', style: TextStyle(), type: 'glitch-cyberpunk')));
    await t.pump(const Duration(milliseconds: 900));
    expect(find.text('X'), findsNWidgets(3));
  });

  // Like the web, the text-runs vector is laid out from its content, not from its textRuns lines.
  testWidgets('the text-runs vector lays out its content, not the precalculated lines', (t) async {
    final bytes = File(p.join(_spec, 'vectors', 'text-runs-precalculated.oim.png')).readAsBytesSync();
    await t.pumpWidget(MaterialApp(home: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: bytes, showBaseImage: false))));
    await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await t.pump();
    expect(find.text('Primera línea\nSegunda línea'), findsOneWidget);
    expect(find.text('Primera línea'), findsNothing);
  });
}
