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

const _png4 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4nh8IRwzEcQC5Ehpxr683xgAAAABJRU5ErkJggg==';

Future<void> _pump(WidgetTester t, Map<String, dynamic> style) async {
  final meta = {
    'canvas': {'natural_width': 800, 'natural_height': 600},
    'slots': [
      {'id': 'box', 'type': 'geo', 'position': [10, 10], 'style': {'width': '30cqw', 'height': '30cqw', ...style}},
    ],
  };
  await t.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _oim(meta), showBaseImage: false)),
  ));
  await t.pump();
}

// The player's root language-switch blur is not a media filter.
final _mediaBlur = find.byWidgetPredicate((w) => w is ImageFiltered && w.key != const ValueKey('oim-language-blur'));

void main() {
  // Web (render/image-fill.ts): media filters go on the fill's <img>, inside the clip; the colour,
  // the stroke and the rest of the layer stay sharp.
  testWidgets('a media filter on an image fill blurs the picture inside its clip only', (t) async {
    await _pump(t, {'fillType': 'image', 'fillImage': _png4, 'fillColor': '#d4d4d8', 'filterBlur': 6, 'strokeColor': '#111111', 'strokeWidth': 4});
    final blurs = _mediaBlur;
    expect(blurs, findsOneWidget);
    expect(find.ancestor(of: blurs, matching: find.byType(ClipRRect)), findsOneWidget);
  });

  // Web applies mediaFilterCss only to image layers and image fills (ImageEngine.ts, image-fill.ts).
  testWidgets('a media filter on a plain colour shape does nothing', (t) async {
    await _pump(t, {'fillColor': '#d4d4d8', 'filterBlur': 6});
    expect(_mediaBlur, findsNothing);
  });

  // borderColor / borderWidth are not contract keys (the stroke is strokeColor / strokeWidth); the web ignores them.
  testWidgets('borderColor and borderWidth draw no stroke', (t) async {
    await _pump(t, {'fillColor': '#d4d4d8', 'borderColor': '#111111', 'borderWidth': 4});
    final bordered = t.widgetList<Container>(find.byType(Container)).where((c) => c.decoration is BoxDecoration && (c.decoration as BoxDecoration).border != null);
    expect(bordered, isEmpty);
  });
}
