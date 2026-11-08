// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
import 'dart:ui' as ui;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/effects.dart';

const box = SizedBox(width: 10, height: 10);
Map<String, dynamic> fx(List<Map<String, dynamic>> e) => {'effects': e};

void main() {
  test('no effects returns the child untouched', () {
    expect(identical(layerEffects(box, {}, null, isText: false), box), isTrue);
  });

  test('blur uses the radius as sigma, default 8', () {
    final w = layerEffects(box, fx([{'type': 'blur'}]), null, isText: true) as ImageFiltered;
    expect(w.imageFilter, ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8, tileMode: TileMode.decal));
  });

  test('drop-shadow casts the silhouette under the layer, sigma = blur/2', () {
    final w = layerEffects(box, fx([{'type': 'drop-shadow', 'x': 3, 'y': 5, 'blur': 10, 'color': '#ff0000'}]), null, isText: false) as Stack;
    expect(w.children.last, same(box));
    final t = w.children.first as Transform;
    expect(t.transform.getTranslation().x, 3);
    expect(t.transform.getTranslation().y, 5);
    final blur = t.child as ImageFiltered;
    expect(blur.imageFilter, ui.ImageFilter.blur(sigmaX: 5, sigmaY: 5, tileMode: TileMode.decal));
    expect((blur.child as ColorFiltered).colorFilter, const ColorFilter.mode(Color(0xFFFF0000), BlendMode.srcIn));
  });

  test('glow is two silhouettes, radius*0.4 then radius', () {
    final outer = layerEffects(box, fx([{'type': 'glow', 'radius': 20}]), null, isText: false) as Stack;
    final inner = outer.children.last as Stack;
    expect(inner.children.last, same(box));
    ImageFiltered blurOf(Stack s) => (s.children.first as Transform).child as ImageFiltered;
    expect(blurOf(inner).imageFilter, ui.ImageFilter.blur(sigmaX: 4, sigmaY: 4, tileMode: TileMode.decal));
    expect(blurOf(outer).imageFilter, ui.ImageFilter.blur(sigmaX: 10, sigmaY: 10, tileMode: TileMode.decal));
  });

  test('text layers skip shadow and glow (they are text-shadows) and disabled effects', () {
    expect(identical(layerEffects(box, fx([{'type': 'drop-shadow'}, {'type': 'glow'}]), null, isText: true), box), isTrue);
    expect(identical(layerEffects(box, fx([{'type': 'blur', 'enabled': false}]), null, isText: false), box), isTrue);
  });

  test('a non-empty effects stack replaces the legacy shadow, as on the web', () {
    final legacy = {'shadowEnabled': true, 'shadowBlur': 4};
    expect(shadowOf(legacy), isNotNull);
    expect(shadowOf({...legacy, 'effects': [{'type': 'blur'}]}), isNull);
    expect(shadowOf({...legacy, 'effects': []}), isNotNull);
  });
}
