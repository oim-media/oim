// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';

// A PNG signature plus an OIM_Data tEXt chunk of raw-deflated JSON: all the extractor needs.
Uint8List _oim(Map<String, dynamic> meta) {
  final body = [...latin1.encode('OIM_Data'), 0, ...ZLibEncoder(raw: true).convert(utf8.encode(jsonEncode(meta)))];
  final len = ByteData(4)..setUint32(0, body.length);
  return Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, ...len.buffer.asUint8List(), ...latin1.encode('tEXt'), ...body, 0, 0, 0, 0]);
}

const _icon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16"/></svg>';

// The retro work's play badge (Vintage Retro Club, p3): a circle with a hard drop shadow and an SVG icon.
Map<String, dynamic> _badge({bool withIcon = false, Map<String, dynamic> extra = const {}}) => {
      'canvas': {'natural_width': 200, 'natural_height': 200},
      'slots': [
        {
          'id': 'circle',
          'type': 'geo',
          'position': [25, 25],
          'style': {
            'geoShape': 'circle',
            'width': '50cqw',
            'height': '50cqw',
            'fillColor': '#8F260C',
            'shadowEnabled': true,
            'shadowColor': '#1F1714',
            'shadowOffsetX': 6,
            'shadowOffsetY': 6,
            'shadowBlur': 0,
            'shadowOpacity': 100,
            ...extra,
          },
        },
        if (withIcon)
          {
            'id': 'icon',
            'type': 'svg',
            'position': [40, 40],
            'content': {'*': _icon},
            'style': {'width': '20cqw', 'height': '20cqw', 'fillColor': 'transparent', 'strokeColor': '#FFFFFF', 'strokeWidth': 2},
          },
      ],
    };

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
  final image = await t.runAsync(() => (key.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage());
  return (await t.runAsync(() => image!.toByteData(format: ui.ImageByteFormat.rawRgba)))!;
}

int _alpha(ByteData px, int x, int y) => px.getUint8((y * 200 + x) * 4 + 3);

void main() {
  testWidgets('a circle casts a round shadow, not a square one', (t) async {
    final px = await _pixels(t, _badge());
    // The shadow colour #1F1714: its bounding box's corner lies outside a round shadow,
    // and a rectangular BoxShadow (the dark square) filled it.
    bool isShadow(int x, int y) {
      final i = (y * 200 + x) * 4;
      return px.getUint8(i) == 0x1F && px.getUint8(i + 1) == 0x17 && px.getUint8(i + 2) == 0x14 && px.getUint8(i + 3) == 255;
    }
    var maxX = -1, maxY = -1;
    for (var y = 0; y < 200; y++) {
      for (var x = 0; x < 200; x++) {
        if (isShadow(x, y)) {
          maxX = x > maxX ? x : maxX;
          maxY = y > maxY ? y : maxY;
        }
      }
    }
    expect(maxX, greaterThan(0), reason: 'the shadow is painted');
    expect(_alpha(px, maxX, maxY), 0);
  });

  testWidgets('a shape is outlined with the contract strokeColor and strokeWidth', (t) async {
    final px = await _pixels(t, _badge(extra: {'strokeColor': '#00FF00', 'strokeWidth': 3}));
    var green = 0;
    for (var i = 0; i < px.lengthInBytes; i += 4) {
      if (px.getUint8(i) == 0 && px.getUint8(i + 1) == 255 && px.getUint8(i + 2) == 0) green++;
    }
    expect(green, greaterThan(100));
  });

  testWidgets('an svg layer draws its markup (content as a language map)', (t) async {
    await _pixels(t, _badge(withIcon: true));
    expect(find.byType(SvgPicture), findsOneWidget);
  });
}
