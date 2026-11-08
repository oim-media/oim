// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';

Uint8List _oim(Map<String, dynamic> meta) {
  final body = [...latin1.encode('OIM_Data'), 0, ...ZLibEncoder(raw: true).convert(utf8.encode(jsonEncode(meta)))];
  final len = ByteData(4)..setUint32(0, body.length);
  return Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, ...len.buffer.asUint8List(), ...latin1.encode('tEXt'), ...body, 0, 0, 0, 0]);
}

void main() {
  // The web draws a rectangle's stroke as a CSS border on a content-box element: the box
  // grows by the stroke on every side, keeps its vertical centre and its textAlign anchor,
  // and the stroke scales with the canvas like everything else.
  Future<(Rect, double)> boxOf(WidgetTester t, String align) async {
    final meta = {
      'canvas': {'natural_width': 800, 'natural_height': 800},
      'slots': [
        {'id': 'card', 'type': 'geo', 'position': [10, 10],
         'style': {'width': '50cqw', 'height': '25cqw', 'fillColor': '#ffffff', 'strokeColor': '#ff0000', 'strokeWidth': 10, 'textAlign': align}},
      ],
    };
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: Align(alignment: Alignment.topLeft, child: SizedBox(width: 400, height: 400, child: OimPlayer(bytes: _oim(meta), showBaseImage: false))),
    ));
    await t.pump();
    final box = find.byWidgetPredicate((w) => w is Container && w.decoration is BoxDecoration && (w.decoration as BoxDecoration).border != null);
    final border = ((t.widget<Container>(box).decoration as BoxDecoration).border as Border).top.width;
    return (t.getRect(box), border);
  }

  testWidgets('the stroke scales with the canvas', (t) async {
    expect((await boxOf(t, 'left')).$2, 5); // 10 design px on a canvas drawn at half size
  });

  testWidgets('the box grows outward, anchored left and by its vertical centre', (t) async {
    // Content box: left 40, top 40, 200 x 100. Border 5.
    expect((await boxOf(t, 'left')).$1, const Rect.fromLTWH(40, 35, 210, 110));
  });

  testWidgets('a centred layer grows on both sides', (t) async {
    expect((await boxOf(t, 'center')).$1, const Rect.fromLTWH(35, 35, 210, 110));
  });
}
