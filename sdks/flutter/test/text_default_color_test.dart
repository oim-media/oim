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
  // A text without `fillColor` is black, the browser's default text colour. Like the root
  // DefaultTextStyle, it ignores the host's style (here a red one).
  testWidgets('text without fillColor is black, not the host colour', (t) async {
    const host = Color(0xFFAA0000);
    final meta = {
      'canvas': {'natural_width': 800, 'natural_height': 600},
      'slots': [
        {'id': 'title', 'type': 'text', 'position': [0, 0], 'content': {'en': 'Hola'}, 'style': {'width': '50cqw', 'height': '10cqw', 'fontSize': '5cqw'}},
      ],
    };
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: DefaultTextStyle(
        style: const TextStyle(color: host),
        child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false)),
      ),
    ));
    await t.pump();
    final rich = t.widget<RichText>(find.descendant(of: find.text('Hola'), matching: find.byType(RichText)));
    expect(rich.text.style?.color, const Color(0xFF000000));
  });
}
