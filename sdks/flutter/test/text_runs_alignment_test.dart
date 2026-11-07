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
  // Web lays text out itself and ignores textRuns (packages/player-oim text-runs-render.test.ts);
  // Flutter has a paragraph engine too, so it must not follow the exporter's line breaks either.
  // Real case: the editor broke "EST. 94" in two although it fits on one line.
  testWidgets('textRuns line breaks are ignored: the text is laid out like on the web', (t) async {
    final meta = {
      'canvas': {'natural_width': 800, 'natural_height': 600},
      'slots': [
        {
          'id': 'badge',
          'type': 'text',
          'position': [0, 0],
          'content': {'es': 'EST. 94'},
          'style': {
            'width': '50cqw',
            'height': '10cqw',
            'fontSize': '3cqw',
            'textRuns': {
              'es': {'fontSize': 24, 'lineHeight': 30, 'lines': [{'text': 'EST.', 'width': 50, 'yOffset': 0}, {'text': '94', 'width': 25, 'yOffset': 30}]},
            },
          },
        },
      ],
    };
    await t.pumpWidget(MaterialApp(
      home: Align(alignment: Alignment.topLeft, child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false))),
    ));
    await t.pump();
    expect(find.text('EST. 94'), findsOneWidget);
    expect(find.text('94'), findsNothing);
  });

  // Web: text-align is style.textAlign, else the slot's `align`, else left; and the text is
  // centred vertically in its box whether or not it has precalculated lines.
  testWidgets('text without textRuns follows the slot align and is centred vertically', (t) async {
    final meta = {
      'canvas': {'natural_width': 800, 'natural_height': 600},
      'slots': [
        {
          'id': 'title',
          'type': 'text',
          'align': 'center',
          'position': [0, 0],
          'content': {'es': 'Hola'},
          'style': {'width': '50cqw', 'height': '20cqw', 'fontSize': '5cqw'},
        },
      ],
    };
    await t.pumpWidget(MaterialApp(
      home: Align(alignment: Alignment.topLeft, child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false))),
    ));
    await t.pump();
    // Box 400 x 160 at the origin. The paragraph is centred, and only as tall as its line.
    final rich = find.descendant(of: find.text('Hola'), matching: find.byType(RichText));
    expect(t.widget<RichText>(rich).textAlign, TextAlign.center);
    final para = t.renderObject<RenderBox>(rich);
    final top = para.localToGlobal(Offset.zero).dy;
    expect(top + para.size.height / 2, closeTo(80, 1));
    expect(para.size.height, lessThan(160));
    // Web: `.oim-slot` has `padding: 0 0.25em 0 0` (content-box) and is centred on its
    // position, so the text area sits 0.125em left of the box centre: 200 - 0.125 * 40.
    expect(para.localToGlobal(Offset.zero).dx + para.size.width / 2, closeTo(195, 1));
  });

  // Web: the slot is translated by -100% (right), -50% (centre) or 0% (left) of its padded box,
  // so the 0.25em right padding moves the text by all, half or none of it.
  for (final (align, right) in [('left', null), ('right', 390.0)]) {
    testWidgets('slot padding shift follows align $align', (t) async {
      final meta = {
        'canvas': {'natural_width': 800, 'natural_height': 600},
        'slots': [
          {
            'id': 'title',
            'type': 'text',
            'align': align,
            'position': [0, 0],
            'content': {'es': 'Hola'},
            'style': {'width': '50cqw', 'height': '20cqw', 'fontSize': '5cqw'},
          },
        ],
      };
      await t.pumpWidget(MaterialApp(
        home: Align(alignment: Alignment.topLeft, child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false))),
      ));
      await t.pump();
      final para = t.renderObject<RenderBox>(find.descendant(of: find.text('Hola'), matching: find.byType(RichText)));
      final rect = para.localToGlobal(Offset.zero) & para.size;
      if (right == null) {
        expect(rect.left, closeTo(0, 1));
      } else {
        expect(rect.right, closeTo(right, 1));
      }
    });
  }
}
