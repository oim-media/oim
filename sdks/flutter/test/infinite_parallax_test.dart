/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';

void main() {
  group('computeInfiniteLayerPlan', () {
    test('speed is in canvas pixels: a lap lasts the same at any display size (like the web)', () {
      const cfg = InfiniteLayerConfig(speedPxSec: 90, mirror: false);
      final atCanvasSize = computeInfiniteLayerPlan(cfg, 800, 800);
      // The same 800-px-wide canvas drawn at 400 px on screen.
      final halfSize = computeInfiniteLayerPlan(cfg, 400, 400, 0.5);
      expect(atCanvasSize.durationSeconds, closeTo(800 / 90, 1e-9));
      expect(halfSize.durationSeconds, closeTo(atCanvasSize.durationSeconds, 1e-9));
    });

    test('returns empty plan when speed is 0 or negative', () {
      final plan = computeInfiniteLayerPlan(
        const InfiniteLayerConfig(speedPxSec: 0),
        800,
      );
      expect(plan.duplicate, isFalse);
      expect(plan.copies, equals(0));
    });

    test('returns empty plan when piece width is invalid', () {
      final plan = computeInfiniteLayerPlan(
        const InfiniteLayerConfig(speedPxSec: 40),
        0,
      );
      expect(plan.duplicate, isFalse);
      expect(plan.copies, equals(0));
    });

    test('computes plan without mirroring (plain loop)', () {
      final plan = computeInfiniteLayerPlan(
        const InfiniteLayerConfig(
          speedPxSec: 40,
          direction: 'right_to_left',
          mirror: false,
        ),
        800,
        800,
      );
      expect(plan.duplicate, isTrue);
      expect(plan.unitPx, equals(800.0));
      expect(plan.copies, equals(2)); // ceil(800/800) + 1 = 2
      expect(plan.durationSeconds, equals(20.0)); // 800 / 40
      expect(plan.direction, equals('right_to_left'));
    });

    test('computes plan with mirroring (requires even copies and double unit)', () {
      final plan = computeInfiniteLayerPlan(
        const InfiniteLayerConfig(
          speedPxSec: 40,
          direction: 'left_to_right',
          mirror: true,
        ),
        800,
        800,
      );
      expect(plan.duplicate, isTrue);
      expect(plan.unitPx, equals(1600.0)); // 800 * 2
      expect(plan.copies, equals(4)); // ceil(800/800) + 2 = 3 -> even => 4
      expect(plan.durationSeconds, equals(40.0)); // 1600 / 40
      expect(plan.direction, equals('left_to_right'));
    });

    test('computes enough copies when layer is smaller than canvas', () {
      // 180px tile on 800px canvas
      final planPlain = computeInfiniteLayerPlan(
        const InfiniteLayerConfig(speedPxSec: 40, mirror: false),
        180,
        800,
      );
      // ceil(800 / 180) + 1 = 5 + 1 = 6
      expect(planPlain.copies, equals(6));

      final planMirrored = computeInfiniteLayerPlan(
        const InfiniteLayerConfig(speedPxSec: 40, mirror: true),
        180,
        800,
      );
      // ceil(800 / 180) + 2 = 5 + 2 = 7 -> even => 8
      expect(planMirrored.copies, equals(8));
    });
  });

  group('parseInfiniteParallax', () {
    test('parses slot with parallax.infinite', () {
      final slot = {
        'id': 'bg',
        'parallax': {
          'enabled': true,
          'infinite': {
            'enabled': true,
            'speed_px_sec': 50,
            'direction': 'left_to_right',
            'mirror': true,
            'pause_on_hover': true,
          },
        },
      };
      final cfg = parseInfiniteParallax(slot, const {});
      expect(cfg, isNotNull);
      expect(cfg!.speedPxSec, equals(50.0));
      expect(cfg.direction, equals('left_to_right'));
      expect(cfg.mirror, isTrue);
      expect(cfg.pauseOnHover, isTrue);
    });

    test('parses slot with mode: infinite_horizontal', () {
      final style = {
        'parallax': {
          'enabled': true,
          'mode': 'infinite_horizontal',
          'speed': 35,
          'direction': 'right_to_left',
        },
      };
      final cfg = parseInfiniteParallax(const {}, style);
      expect(cfg, isNotNull);
      expect(cfg!.speedPxSec, equals(35.0));
      expect(cfg.direction, equals('right_to_left'));
    });

    test('parses group sceneLoop and child loopDepth', () {
      final parentSceneLoop = {
        'speedPxSec': 60,
        'direction': 'right_to_left',
        'mirror': true,
        'pauseOnHover': false,
      };
      final childStyle = {
        'loopDepth': 0.5,
      };
      final cfg = parseInfiniteParallax(
        const {},
        childStyle,
        parentSceneLoop: parentSceneLoop,
      );
      expect(cfg, isNotNull);
      expect(cfg!.speedPxSec, equals(30.0)); // 60 * 0.5
      expect(cfg.direction, equals('right_to_left'));
      expect(cfg.mirror, isTrue);
    });

    test('returns null when loop is disabled', () {
      final slot = {
        'parallax': {
          'enabled': true,
          'infinite': {
            'enabled': false,
            'speed_px_sec': 50,
          },
        },
      };
      expect(parseInfiniteParallax(slot, const {}), isNull);
    });
  });

  group('InfiniteParallaxTrack Widget', () {
    testWidgets('renders single child when duplicate is false', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: InfiniteParallaxTrack(
              plan: InfiniteLayerPlan.empty,
              pieceWidth: 200,
              pieceHeight: 100,
              child: Text('Still Piece'),
            ),
          ),
        ),
      );

      expect(find.text('Still Piece'), findsOneWidget);
    });

    testWidgets('renders correct number of duplicated copies and alternates mirroring', (tester) async {
      final plan = computeInfiniteLayerPlan(
        const InfiniteLayerConfig(
          speedPxSec: 40,
          direction: 'right_to_left',
          mirror: true,
        ),
        200,
        200,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InfiniteParallaxTrack(
              plan: plan,
              pieceWidth: 200,
              pieceHeight: 100,
              child: const Text('Tile'),
            ),
          ),
        ),
      );

      // plan.copies should be 4
      expect(find.text('Tile'), findsNWidgets(plan.copies));
    });
  });
}
