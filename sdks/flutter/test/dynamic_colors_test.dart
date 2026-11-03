/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/dynamic_colors.dart';

void main() {
  group('Dynamic Colors & Palettes', () {
    test('isValidDynamicColorRole recognizes all 12 canonical roles', () {
      expect(isValidDynamicColorRole('primary'), isTrue);
      expect(isValidDynamicColorRole('on-primary'), isTrue);
      expect(isValidDynamicColorRole('secondary'), isTrue);
      expect(isValidDynamicColorRole('on-secondary'), isTrue);
      expect(isValidDynamicColorRole('surface'), isTrue);
      expect(isValidDynamicColorRole('on-surface'), isTrue);
      expect(isValidDynamicColorRole('outline'), isTrue);
      expect(isValidDynamicColorRole('accent'), isTrue);
      expect(isValidDynamicColorRole('text-primary'), isTrue);
      expect(isValidDynamicColorRole('text-secondary'), isTrue);
      expect(isValidDynamicColorRole('text-muted'), isTrue);
      expect(isValidDynamicColorRole('text-on-accent'), isTrue);

      expect(isValidDynamicColorRole('custom-role'), isFalse);
      expect(isValidDynamicColorRole(null), isFalse);
      expect(isValidDynamicColorRole(123), isFalse);
    });

    test('resolvePalette chooses requested palette when available', () {
      final meta = {
        'defaultPalette': 'light',
        'palettes': {
          'light': {'primary': '#ffffff', 'surface': '#f4f4f5'},
          'dark': {'primary': '#000000', 'surface': '#18181b'},
          'brand': {'primary': '#3b82f6'},
        }
      };

      final palette = resolvePalette(meta, requested: 'brand');
      expect(palette, isNotNull);
      expect(palette!['primary'], const Color(0xFF3B82F6));
    });

    test('resolvePalette respects prefersDark when both dark and light exist', () {
      final meta = {
        'defaultPalette': 'light',
        'palettes': {
          'light': {'primary': '#ffffff'},
          'dark': {'primary': '#000000'},
        }
      };

      final darkPal = resolvePalette(meta, prefersDark: true);
      expect(darkPal!['primary'], const Color(0xFF000000));

      final lightPal = resolvePalette(meta, prefersDark: false);
      expect(lightPal!['primary'], const Color(0xFFFFFFFF));
    });

    test('resolveColor falls back to direct color when role is absent or unmapped', () {
      final palette = {'primary': const Color(0xFF3B82F6)};

      // Mapped role
      expect(resolveColor('primary', '#000000', palette), const Color(0xFF3B82F6));

      // Unmapped role falls back
      expect(resolveColor('secondary', '#00ff00', palette), const Color(0xFF00FF00));

      // No role falls back
      expect(resolveColor(null, '#ff0000', palette), const Color(0xFFFF0000));
    });
  });
}
