// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';

Uint8List _oim(Map<String, dynamic> meta) {
  final body = [...latin1.encode('OIM_Data'), 0, ...ZLibEncoder(raw: true).convert(utf8.encode(jsonEncode(meta)))];
  final len = ByteData(4)..setUint32(0, body.length);
  return Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, ...len.buffer.asUint8List(), ...latin1.encode('tEXt'), ...body, 0, 0, 0, 0]);
}

void main() {
  // Like the web element's allow-dynamic-colors="false": the host can refuse the work's
  // palettes, and every role falls back to the literal colour stored in the file.
  final meta = {
    'canvas': {'natural_width': 800, 'natural_height': 600},
    'palettes': {'brand': {'primary': '#FF0000'}},
    'defaultPalette': 'brand',
    'slots': [
      {'id': 't', 'type': 'text', 'position': [0, 0], 'content': {'en': 'Hola'},
       'style': {'width': '50cqw', 'height': '10cqw', 'fontSize': '5cqw', 'fillColor': '#112233', 'fillColorRole': 'primary'}},
    ],
  };

  Future<Color?> colorWith(WidgetTester t, {required bool allow}) async {
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false, allowDynamicColors: allow)),
    ));
    await t.pump();
    return t.widget<RichText>(find.descendant(of: find.text('Hola'), matching: find.byType(RichText))).text.style?.color;
  }

  testWidgets('the palette colours the role by default', (t) async {
    expect(await colorWith(t, allow: true), const Color(0xFFFF0000));
  });

  testWidgets('allowDynamicColors: false keeps the literal colour', (t) async {
    expect(await colorWith(t, allow: false), const Color(0xFF112233));
  });
}
