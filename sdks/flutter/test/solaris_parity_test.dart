// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:oim_flutter/src/ui/patterns.dart';

// A PNG signature plus an OIM_Data tEXt chunk of raw-deflated JSON: all the extractor needs.
Uint8List _oim(Map<String, dynamic> meta) {
  final body = [...latin1.encode('OIM_Data'), 0, ...ZLibEncoder(raw: true).convert(utf8.encode(jsonEncode(meta)))];
  final len = ByteData(4)..setUint32(0, body.length);
  return Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, ...len.buffer.asUint8List(), ...latin1.encode('tEXt'), ...body, 0, 0, 0, 0]);
}

Future<ByteData> _pixels(WidgetTester t, Map<String, dynamic> meta) async {
  final key = GlobalKey();
  await t.pumpWidget(MaterialApp(
    home: Center(
      child: RepaintBoundary(
        key: key,
        child: SizedBox(width: 200, height: 200, child: OimPlayer(bytes: _oim(meta), showBaseImage: false)),
      ),
    ),
  ));
  await t.pumpAndSettle();
  await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
  await t.pump();
  final image = await t.runAsync(() => (key.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage());
  return (await t.runAsync(() => image!.toByteData(format: ui.ImageByteFormat.rawRgba)))!;
}

void main() {
  // Exporters may write the canvas background last (Colección Editorial OIM 2026, «Solaris Groove»).
  // The web gives it z-index 0 and every other layer 1, so it stays behind whatever its place in `slots`.
  testWidgets('the background pattern slot stays behind the layers, wherever it is listed', (t) async {
    final px = await _pixels(t, {
      'canvas': {'natural_width': 200, 'natural_height': 200},
      'slots': [
        {
          'id': 'card',
          'type': 'geo',
          'position': [25, 25],
          'style': {'geoShape': 'rectangle', 'width': '50cqw', 'height': '50cqw', 'fillColor': '#FF0000'},
        },
        {
          'id': 'background-pattern-slot',
          'type': 'geo',
          'position': [0, 0],
          'style': {
            'width': '100cqw',
            'height': '100cqw',
            'backgroundType': 'pattern',
            'backgroundPatternType': 'waves',
            'backgroundPatternBgColor': '#00FF00',
            'backgroundPatternColor': '#0000FF',
          },
        },
      ],
    });
    final i = (100 * 200 + 100) * 4;
    expect([px.getUint8(i), px.getUint8(i + 1), px.getUint8(i + 2)], [255, 0, 0]);
  });

  // A circle photo with a hard shadow (Solaris Groove): the shadow was painted over the photo.
  testWidgets('a shape with a picture fill keeps its shadow underneath', (t) async {
    final px = await _pixels(t, {
      'canvas': {'natural_width': 200, 'natural_height': 200},
      'slots': [
        {
          'id': 'photo',
          'type': 'geo',
          'position': [25, 25],
          'style': {
            'geoShape': 'circle',
            'width': '50cqw',
            'height': '50cqw',
            'fillType': 'image',
            'fillImage': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
            'shadowEnabled': true,
            'shadowColor': '#00FF00',
            'shadowOffsetX': 6,
            'shadowOffsetY': 6,
            'shadowOpacity': 100,
          },
        },
      ],
    });
    final i = (100 * 200 + 100) * 4;
    expect([px.getUint8(i), px.getUint8(i + 1), px.getUint8(i + 2)], isNot([0, 255, 0]));
  });

  test('recolour swaps whole hex colours in one pass', () {
    expect(recolorPatternSvg('<a fill="#fff"/><b fill="#ffffff"/><c fill="#000"/>', {'#fff': '#000', '#000': '#fff'}),
        '<a fill="#000"/><b fill="#ffffff"/><c fill="#fff"/>');
  });

  // The web paints the tile stored in the file; Flutter regenerated its own, which drifted.
  testWidgets('a background pattern paints the tile stored in the file', (t) async {
    final px = await _pixels(t, {
      'canvas': {'natural_width': 200, 'natural_height': 200},
      'slots': [
        {
          'id': 'background-pattern-slot',
          'type': 'geo',
          'position': [0, 0],
          'style': {
            'width': '100cqw',
            'height': '100cqw',
            'backgroundType': 'pattern',
            'backgroundPatternType': 'waves',
            'backgroundPatternBgColor': '#00FF00',
            'backgroundPatternColor': '#0000FF',
            'svgRawXml': '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#FF0000"/></svg>',
          },
        },
      ],
    });
    final i = (100 * 200 + 100) * 4;
    expect([px.getUint8(i), px.getUint8(i + 1), px.getUint8(i + 2)], [255, 0, 0]);
  });

  // The web writes letterSpacing as-is: a bare number is invalid CSS, so the letters are not spaced
  // (Solaris Groove's kicker ran into its icon in Flutter only).
  testWidgets('a unitless letterSpacing is ignored, like the browser does', (t) async {
    Future<double> widthWith(Object? spacing) async {
      await _pixels(t, {
        'canvas': {'natural_width': 200, 'natural_height': 200},
        'slots': [
          {
            'id': 'txt',
            'type': 'text',
            'position': [0, 0],
            'content': {'*': 'ABCDEFGH'},
            'style': {'width': '100cqw', 'height': '20cqw', 'fontSize': '5cqw', if (spacing != null) 'letterSpacing': spacing},
          },
        ],
      });
      return t.renderObject<RenderParagraph>(find.text('ABCDEFGH')).getMaxIntrinsicWidth(double.infinity);
    }

    final plain = await widthWith(null);
    expect(await widthWith(4), plain);
    expect(await widthWith('4px'), closeTo(plain + 8 * 4, 0.5));
  });
}
