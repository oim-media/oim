import 'dart:math' as math;
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lottie/lottie.dart';
import 'package:oim_flutter/oim_flutter.dart';

void main() {
  const sampleLottieJson = '{"v":"5.5.7","fr":60,"ip":0,"op":60,"w":100,"h":100,"nm":"Test","ddd":0,"assets":[],"layers":[]}';

  group('LottieSlot.extractLottieJson', () {
    test('extracts direct JSON string', () {
      final res = LottieSlot.extractLottieJson(sampleLottieJson, 'es');
      expect(res, equals(sampleLottieJson));
    });

    test('extracts from localized map with target language', () {
      final content = {
        'es': sampleLottieJson,
        'en': '{"v":"english"}',
      };
      final res = LottieSlot.extractLottieJson(content, 'es');
      expect(res, equals(sampleLottieJson));
    });

    test('falls back to wildcard * or fallback languages', () {
      final content = {
        '*': sampleLottieJson,
      };
      final res = LottieSlot.extractLottieJson(content, 'fr');
      expect(res, equals(sampleLottieJson));
    });

    test('serializes direct Map object to JSON string', () {
      final content = {
        'v': '5.5.7',
        'fr': 60,
        'ip': 0,
        'op': 60,
      };
      final res = LottieSlot.extractLottieJson(content, 'es');
      expect(res, isNotNull);
      final decoded = jsonDecode(res!) as Map<String, dynamic>;
      expect(decoded['v'], equals('5.5.7'));
      expect(decoded['fr'], equals(60));
    });

    test('extracts data URI with base64 encoding', () {
      final b64 = base64Encode(utf8.encode(sampleLottieJson));
      final uri = 'data:application/json;base64,$b64';
      final res = LottieSlot.extractLottieJson(uri, 'es');
      expect(res, equals(sampleLottieJson));
    });

    test('rejects external HTTP/HTTPS URLs for offline safety', () {
      expect(LottieSlot.extractLottieJson('https://example.com/anim.json', 'es'), isNull);
      expect(LottieSlot.extractLottieJson('http://example.com/anim.json', 'es'), isNull);
    });

    test('returns null for empty or null content', () {
      expect(LottieSlot.extractLottieJson(null, 'es'), isNull);
      expect(LottieSlot.extractLottieJson('', 'es'), isNull);
    });
  });

  group('LottieSlot.resolveBoxFit', () {
    test('resolves standard CSS object-fit values', () {
      expect(LottieSlot.resolveBoxFit('cover'), equals(BoxFit.cover));
      expect(LottieSlot.resolveBoxFit('fill'), equals(BoxFit.fill));
      expect(LottieSlot.resolveBoxFit('none'), equals(BoxFit.none));
      expect(LottieSlot.resolveBoxFit('scale-down'), equals(BoxFit.scaleDown));
      expect(LottieSlot.resolveBoxFit('contain'), equals(BoxFit.contain));
      expect(LottieSlot.resolveBoxFit(null), equals(BoxFit.contain));
      expect(LottieSlot.resolveBoxFit('unknown'), equals(BoxFit.contain));
    });
  });

  group('LottieSlot widget', () {
    testWidgets('renders Lottie when allowLottie is true', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LottieSlot(
              slot: {
                'id': 'lottie-1',
                'type': 'lottie',
                'content': sampleLottieJson,
              },
              style: const {
                'width': '100px',
                'height': '100px',
              },
              allowLottie: true,
            ),
          ),
        ),
      );

      expect(find.byType(Lottie), findsOneWidget);
    });

    testWidgets('renders SizedBox.shrink when allowLottie is false', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LottieSlot(
              slot: {
                'id': 'lottie-1',
                'type': 'lottie',
                'content': sampleLottieJson,
              },
              style: const {},
              allowLottie: false,
            ),
          ),
        ),
      );

      expect(find.byType(Lottie), findsNothing);
      expect(find.byType(SizedBox), findsOneWidget);
    });

    testWidgets('renders SizedBox.shrink when content is invalid or missing', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: LottieSlot(
              slot: {
                'id': 'lottie-empty',
                'type': 'lottie',
                'content': null,
              },
              style: {},
              allowLottie: true,
            ),
          ),
        ),
      );

      expect(find.byType(Lottie), findsNothing);
    });
  });

  group('LottieSlot.forwardPolystars', () {
    test('a reversed star (d: 3) is drawn forward, everything else is untouched', () {
      const json = '{"layers":[{"shapes":[{"ty":"gr","it":[{"ty":"sr","d":3,"nm":"star"},{"ty":"sh","d":3}]}]}]}';
      final out = jsonDecode(LottieSlot.forwardPolystars(json)) as Map;
      final items = ((out['layers'] as List)[0]['shapes'] as List)[0]['it'] as List;
      expect(items[0]['d'], 1);
      expect(items[0]['nm'], 'star');
      expect(items[1]['d'], 3);
    });

    test('rounded star handles get lottie-web length, static and keyframed', () {
      const json = '{"shapes":[{"ty":"sr","sy":1,"d":1,"pt":{"a":1,"k":[{"t":0,"s":[3]},{"t":9,"s":[8]}]},'
          '"os":{"a":0,"k":100},"is":{"a":1,"k":[{"t":0,"s":[60]}]}}]}';
      final sr = ((jsonDecode(LottieSlot.forwardPolystars(json)) as Map)['shapes'] as List)[0] as Map;
      const f = math.pi / 16 / 0.47829;
      expect(sr['os']['k'], closeTo(100 * f, 1e-9));
      expect(sr['is']['k'][0]['s'][0], closeTo(60 * f, 1e-9));
    });

    test('a Lottie without stars comes back as the same string', () {
      expect(LottieSlot.forwardPolystars(sampleLottieJson), same(sampleLottieJson));
    });
  });
}
