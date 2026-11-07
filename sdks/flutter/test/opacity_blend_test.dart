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

Future<void> _pump(WidgetTester t, Map<String, dynamic> style) async {
  final meta = {
    'canvas': {'natural_width': 800, 'natural_height': 600},
    'slots': [
      {'id': 'box', 'type': 'geo', 'position': [10, 10], 'style': {'width': '30cqw', 'height': '20cqw', 'fillColor': '#3b82f6', ...style}},
    ],
  };
  await t.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false)),
  ));
  await t.pump();
}

void main() {
  // Contract: style.opacity is 0..100 (web: opacity / 100).
  testWidgets('opacity 70 is 70 %', (t) async {
    await _pump(t, {'opacity': 70});
    final values = t.widgetList<Opacity>(find.byType(Opacity)).map((o) => o.opacity);
    expect(values, contains(closeTo(0.7, 1e-9)));
  });

  // style.blendMode was retired in 1.12.0: readers draw the layer as normal (web ImageEngine.ts).
  testWidgets('a retired blendMode draws the layer as normal', (t) async {
    await _pump(t, {'blendMode': 'multiply'});
    expect(find.byWidgetPredicate((w) => w.runtimeType.toString() == '_BlendMask'), findsNothing);
  });

  // Web: a container is geo-like (ImageEngine.ts isGeoLike) and paints its fillColor.
  testWidgets('a container paints its fill colour', (t) async {
    final meta = {
      'canvas': {'natural_width': 800, 'natural_height': 600},
      'slots': [
        {'id': 'side', 'type': 'container', 'position': [0, 0], 'style': {'width': '30cqw', 'height': '75cqw', 'fillColor': '#1e293b'}},
      ],
    };
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false)),
    ));
    await t.pump();
    final filled = t.widgetList<Container>(find.byType(Container)).where((c) => c.decoration is BoxDecoration && (c.decoration as BoxDecoration).color == const Color(0xFF1E293B));
    expect(filled, isNotEmpty);
  });
}
