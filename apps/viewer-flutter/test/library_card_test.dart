// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:oim_viewer_flutter/library/library_card.dart';
import 'package:oim_viewer_flutter/library/library_client.dart';

final _vector = File('../../packages/spec/vectors/basic-text.oim.png').readAsBytesSync();

var _downloads = 0;

Future<void> _pumpCard(WidgetTester t, Uint8List bytes) async {
  _downloads = 0;
  final client = LibraryClient(fetch: (u, h) async {
    _downloads++;
    return bytes;
  });
  await t.pumpWidget(MaterialApp(
    home: Center(
      child: SizedBox(
        width: 300,
        height: 200,
        child: LibraryCard(
          item: const LibraryItem(id: '1', title: 'Obra', mediaUrl: 'https://x/1.oim.png'),
          client: client,
          onOpen: (_, __) {},
        ),
      ),
    ),
  ));
  await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
  await t.pump();
}

void main() {
Future<void> hoverCard(WidgetTester t) async {
  final mouse = await t.createGesture(kind: PointerDeviceKind.mouse);
  await mouse.addPointer(location: Offset.zero);
  addTearDown(mouse.removePointer);
  await mouse.moveTo(t.getCenter(find.byType(LibraryCard)));
  await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
  await t.pump();
}

  // Changed on request (7 Nov): the grid shows thumbnails; the work is downloaded and played only on hover.
  testWidgets('the grid shows the thumbnail and downloads nothing until hovered', (t) async {
    await _pumpCard(t, _vector);
    expect(find.byType(OimPlayer), findsNothing);
    expect(_downloads, 0);
  });

  testWidgets('hovering a verified file plays it', (t) async {
    await _pumpCard(t, _vector);
    await hoverCard(t);
    expect(_downloads, 1);
    expect(t.widget<OimPlayer>(find.byType(OimPlayer)).disableAnimations, isFalse);
    expect(find.byIcon(Icons.lock_outline), findsNothing);
  });

  testWidgets('an altered file shows a lock and never its layers', (t) async {
    final altered = Uint8List.fromList(_vector);
    // Flip a byte inside the image data, after the signature check's chunks.
    altered[altered.length - 20] ^= 0xFF;
    await _pumpCard(t, altered);
    await hoverCard(t);
    expect(find.byType(OimPlayer), findsNothing);
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
  });
}
