/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/image_fill.dart';

void main() {
  group('Image Fill & Data URIs', () {
    test('decodeDataUri parses base64 data URLs', () {
      // 1x1 transparent png
      const transparentPng =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      final bytes = decodeDataUri(transparentPng);
      expect(bytes, isNotNull);
      expect(bytes!.length, greaterThan(10));
    });

    test('decodeDataUri rejects non-data or malformed URIs', () {
      expect(decodeDataUri(null), isNull);
      expect(decodeDataUri(''), isNull);
      expect(decodeDataUri('https://example.com/photo.png'), isNull);
      expect(decodeDataUri('data:text/plain;base64,aGVsbG8='), isNull);
      expect(decodeDataUri('data:image/png;notbase64,xyz'), isNull);
      expect(decodeDataUri('data:image/png;base64,***invalid***'), isNull);
    });
  });
}
