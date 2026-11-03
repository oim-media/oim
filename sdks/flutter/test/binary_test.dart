/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import 'package:oim_flutter/oim_flutter.dart';

void main() {
  group('Zlib decompressor', () {
    test('decompresses raw deflate JSON', () {
      final sample = {'test': 'value', 'number': 42};
      final jsonStr = jsonEncode(sample);
      final compressed = ZLibEncoder(raw: true).convert(utf8.encode(jsonStr));
      final b64 = base64.encode(compressed);

      final result = decodeAndDecompressJSON(b64);
      expect(result['test'], equals('value'));
      expect(result['number'], equals(42));
    });

    test('decompresses standard zlib JSON', () {
      final sample = {'foo': 'bar'};
      final jsonStr = jsonEncode(sample);
      final compressed = ZLibEncoder(raw: false).convert(utf8.encode(jsonStr));
      final b64 = base64.encode(compressed);

      final result = decodeAndDecompressJSON(b64);
      expect(result['foo'], equals('bar'));
    });

    test('handles uncompressed base64 JSON', () {
      final sample = {'plain': true};
      final jsonStr = jsonEncode(sample);
      final b64 = base64.encode(utf8.encode(jsonStr));

      final result = decodeAndDecompressJSON(b64);
      expect(result['plain'], isTrue);
    });
  });
}
