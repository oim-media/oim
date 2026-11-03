/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/effects.dart';

void main() {
  group('Effects & Filters', () {
    test('mediaFilterCss returns null when style has neutral values', () {
      expect(mediaFilterCss({}), isNull);
      expect(
        mediaFilterCss({
          'filterBlur': 0,
          'filterBrightness': 100,
          'filterContrast': 100,
          'filterSaturate': 100,
          'filterHueRotate': 0,
        }),
        isNull,
      );
    });

    test('mediaFilterCss includes known presets', () {
      expect(mediaFilterCss({'filterPreset': 'grayscale'}), 'grayscale(1)');
      expect(mediaFilterCss({'filterPreset': 'sepia'}), 'sepia(0.8)');
      expect(mediaFilterCss({'filterPreset': 'noir'}), 'grayscale(1) contrast(1.6) brightness(0.9)');
    });

    test('mediaFilterCss appends custom adjustments to preset', () {
      final css = mediaFilterCss({
        'filterPreset': 'grayscale',
        'filterBlur': 5,
        'filterBrightness': 120,
      });
      expect(css, 'grayscale(1) blur(5px) brightness(120%)');
    });

    test('parseCssFilter parses blur and color matrices', () {
      expect(parseCssFilter(null), isNull);
      expect(parseCssFilter(''), isNull);

      final filter = parseCssFilter('blur(4px) brightness(150%) saturate(120%)');
      expect(filter, isNotNull);
      expect(filter!.blurSigma, 4.0);
      expect(filter.matrix, isNotNull);
      expect(filter.matrix!.length, 20);
    });

    test('composeMatrices combines transformations', () {
      final identity = <double>[
        1.0, 0.0, 0.0, 0.0, 0.0, //
        0.0, 1.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 1.0, 0.0,
      ];
      final composed = composeMatrices(identity, identity);
      expect(composed, equals(identity));
    });

    test('shadowOf extracts valid BoxShadow', () {
      expect(shadowOf({'shadowEnabled': false}), isNull);
      expect(shadowOf({}), isNull);

      final s = shadowOf({
        'shadowEnabled': true,
        'shadowColor': '#ff0000',
        'shadowOpacity': 50,
        'shadowOffsetX': 10,
        'shadowOffsetY': 20,
        'shadowBlur': 8,
      });

      expect(s, isNotNull);
      expect(s!.color, const Color.fromRGBO(255, 0, 0, 0.5));
      expect(s.offset, const Offset(10, 20));
      expect(s.blurRadius, 8.0);
    });

    test('blendModeOf maps CSS mix-blend-mode names to Flutter BlendMode', () {
      expect(blendModeOf('multiply'), BlendMode.multiply);
      expect(blendModeOf('screen'), BlendMode.screen);
      expect(blendModeOf('overlay'), BlendMode.overlay);
      expect(blendModeOf('darken'), BlendMode.darken);
      expect(blendModeOf('lighten'), BlendMode.lighten);
      expect(blendModeOf('difference'), BlendMode.difference);
      expect(blendModeOf('exclusion'), BlendMode.exclusion);
      expect(blendModeOf('normal'), isNull);
      expect(blendModeOf(null), isNull);
      expect(blendModeOf('invalid-blend'), isNull);
    });
  });
}
