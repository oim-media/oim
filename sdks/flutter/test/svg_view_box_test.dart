// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';

Uint8List _oim(Map<String, dynamic> meta) {
  final body = [...latin1.encode('OIM_Data'), 0, ...ZLibEncoder(raw: true).convert(utf8.encode(jsonEncode(meta)))];
  final len = ByteData(4)..setUint32(0, body.length);
  return Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, ...len.buffer.asUint8List(), ...latin1.encode('tEXt'), ...body, 0, 0, 0, 0]);
}

void main() {
  // core frameSilhouette: a custom svgPath is drawn in its own svgViewBox, stretched to the box
  // (preserveAspectRatio none). A 24-unit triangle must fill a 280 px box, not its top-left 24 %.
  testWidgets('a custom svgPath is scaled from its svgViewBox', (t) async {
    final meta = {
      'canvas': {'natural_width': 800, 'natural_height': 600},
      'slots': [
        {'id': 'tri', 'type': 'geo', 'position': [0, 0], 'style': {'width': '35cqw', 'height': '35cqw', 'fillColor': '#ff0000', 'strokeColor': '#ff0000', 'strokeWidth': 2, 'svgPath': 'M12 2L22 22H2Z', 'svgViewBox': '0 0 24 24'}},
      ],
    };
    final key = GlobalKey();
    await t.binding.setSurfaceSize(const Size(800, 600));
    await t.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: RepaintBoundary(key: key, child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false)))));
    await t.pump();
    await t.runAsync(() async {
      final img = await (key.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage();
      final d = (await img.toByteData(format: ui.ImageByteFormat.rawRgba))!;
      // The triangle's stroke reaches the bottom of the 280 px box (y = 22/24 * 280 ≈ 257).
      var lowest = -1;
      for (var y = 0; y < 600; y++) {
        for (var x = 0; x < 800; x++) {
          final i = (y * 800 + x) * 4;
          if (d.getUint8(i + 3) > 0 && d.getUint8(i) > 200 && d.getUint8(i + 1) < 80) lowest = y;
        }
      }
      expect(lowest, inInclusiveRange(250, 265));
    });
    await t.binding.setSurfaceSize(null);
  });
}
