/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:test/test.dart';
import 'package:oim_flutter/oim_flutter.dart';

const delEstilo = [
  'width', 'height', 'fontSize', 'borderRadius', 'fillColor',
  'groupId', 'childIds', 'isInteractive', 'states', 'parallax',
  'isVisible', 'reveal', 'animation',
  'fontFamily', 'fontWeight', 'fontStyle', 'textTransform', 'letterSpacing', 'lineHeight',
  'shadowEnabled', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowOpacity',
  'blendMode', 'opacity', 'borderWidth', 'borderColor', 'strokeStyle',
  'filterPreset', 'filterBlur', 'filterBrightness', 'filterContrast', 'filterSaturate', 'filterHueRotate',
  'textRuns',
  'grain', 'grainIntensity', 'grainSize', 'grainBlend',
  'layerBlur',
  'flipX', 'flipY', 'imageCrop', 'alt', 'decorative', 'fillImage', 'fillImageCrop',
  'fillType', 'geoShape', 'svgPath', 'svgViewBox', 'fillImageFlipX', 'fillImageFlipY',
  'fillPatternType', 'fillPatternColor', 'fillPatternColorRole', 'fillPatternBgColor', 'fillPatternBgColorRole',
  'backgroundType', 'backgroundPatternType', 'backgroundPatternColor', 'backgroundPatternColorRole',
  'backgroundPatternBgColor', 'backgroundPatternBgColorRole', 'shadowColorRole',
];

Map<String, dynamic> projectCanonicalOutput(Map<String, dynamic> m) {
  final out = <String, dynamic>{
    'canvas': m['canvas'],
    'signed': m['signature'] != null && (m['signature'] as String).isNotEmpty,
    'key_version': m['key_version'],
  };

  if (m.containsKey('languages') && m['languages'] != null) {
    out['languages'] = m['languages'];
  }

  if (m.containsKey('palettes') && m['palettes'] != null) {
    out['palettes'] = m['palettes'];
    out['defaultPalette'] = m['defaultPalette'];
  }

  if (m.containsKey('reedit') && m['reedit'] != null) {
    out['reedit'] = m['reedit'];
  }
  // 1.27.0: embedded fonts, without their bytes.
  if (m['fonts'] is List) {
    out['fonts'] = [
      for (final f in (m['fonts'] as List).whereType<Map>())
        {'family': f['family'], 'name': f['name'], 'weight': f['weight'], 'style': f['style'], 'format': f['format']},
    ];
  }

  final rawSlots = m['slots'] as List<dynamic>? ?? [];
  out['slots'] = rawSlots.map((rawSlot) {
    final s = rawSlot as Map<String, dynamic>;
    final style = <String, dynamic>{};
    final rawStyle = s['style'] as Map<String, dynamic>?;
    if (rawStyle != null) {
      for (final k in delEstilo) {
        if (rawStyle.containsKey(k) && rawStyle[k] != null) {
          style[k] = rawStyle[k];
        }
      }
    }

    final fila = <String, dynamic>{
      'id': s['id'],
      'type': s['type'],
      'position': s['position'],
    };

    if (s.containsKey('name') && s['name'] != null) {
      fila['name'] = s['name'];
    }
    if (s.containsKey('content') && s['content'] != null) {
      fila['content'] = s['content'];
    }
    if (s.containsKey('parallax') && s['parallax'] != null) {
      fila['parallax'] = s['parallax'];
    }
    if (style.isNotEmpty) {
      fila['style'] = style;
    }

    return fila;
  }).toList();

  return out;
}

void main() {
  // Path to canonical vectors in packages/spec/vectors
  final vectorsDir = Directory(p.normalize(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors')));

  group('OIM Dart Conformance Suite', () {
    test('there are at least 20 normative conformance vectors', () {
      expect(vectorsDir.existsSync(), isTrue, reason: 'Vectors directory must exist at ${vectorsDir.path}');
      final files = vectorsDir.listSync().where((f) => f.path.endsWith('.oim.png')).toList();
      expect(files.length, greaterThanOrEqualTo(20));
    });

    final vectorFiles = vectorsDir.existsSync()
        ? vectorsDir.listSync().where((f) => f.path.endsWith('.oim.png')).map((f) => p.basename(f.path)).toList()
        : <String>[];
    vectorFiles.sort();

    for (final filename in vectorFiles) {
      test('Vector: $filename produces exact canonical result', () {
        final oimPath = p.join(vectorsDir.path, filename);
        final expectedPath = p.join(vectorsDir.path, filename.replaceAll('.oim.png', '.expected.json'));

        expect(File(expectedPath).existsSync(), isTrue, reason: 'Expected JSON must exist for $filename');

        final expectedRaw = jsonDecode(File(expectedPath).readAsStringSync()) as Map<String, dynamic>;
        // 'description' is human documentation, not part of canonical result
        expectedRaw.remove('description');

        final pngBytes = File(oimPath).readAsBytesSync();
        final result = extractOIM(pngBytes);
        final actual = projectCanonicalOutput(result.metadata);

        expect(actual, equals(expectedRaw));
      });
    }
  });
}
