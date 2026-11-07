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

  // Web (ImageEngine, unified effects stack): on text, drop-shadow is one text-shadow and glow
  // is two, blur r*0.4 then r; disabled effects and other types draw nothing here.
  test('text effects become the same text shadows as the web', () {
    final shadows = textEffectShadows({
      'effects': [
        {'type': 'glow', 'color': '#FCD34D', 'radius': 48},
        {'type': 'drop-shadow', 'x': 2, 'y': 3, 'blur': 5, 'color': '#000000'},
        {'type': 'glow', 'radius': 10, 'enabled': false},
        {'type': 'blur', 'radius': 4},
      ],
    }, null);
    expect(shadows.length, 3);
    expect(shadows[0].blurRadius, closeTo(19.2, 1e-9));
    expect(shadows[1].blurRadius, 48);
    expect(shadows[0].color, const Color(0xFFFCD34D));
    expect(shadows[0].offset, Offset.zero);
    expect(shadows[2].offset, const Offset(2, 3));
    expect(shadows[2].blurRadius, 5);
    // Defaults as on the web: glow radius 16 in amber, drop-shadow y 4 blur 12.
    final d = textEffectShadows({'effects': [{'type': 'glow'}, {'type': 'drop-shadow'}]}, null);
    expect(d[1].blurRadius, 16);
    expect(d[0].color, const Color(0xFFF59E0B));
    expect(d[2].offset, const Offset(0, 4));
    expect(d[2].blurRadius, 12);
    expect(textEffectShadows({}, null), isEmpty);
  });
}

