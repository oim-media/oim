// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/patterns.dart';

void main() {
  // A moving pattern rebuilt with another palette made a second ticker and threw
  // (found on a real work, MIDORI ZE, when its palette changed).
  const style = {
    'fillPatternType': 'dots',
    'fillPatternColor': '#a3e635',
    'fillPatternColorRole': 'accent',
    'fillPatternSpeed': 4,
  };

  Widget fill(Map<String, Color> palette) => Directionality(
        textDirection: TextDirection.ltr,
        child: SizedBox(width: 200, height: 200, child: OimPatternFill(style: style, palette: palette, unit: 1, disableAnimations: false)),
      );

  testWidgets('a moving pattern survives a palette change', (t) async {
    await t.pumpWidget(fill({'accent': const Color(0xFFFF0000)}));
    await t.pumpWidget(fill({'accent': const Color(0xFF00FF00)}));
    expect(t.takeException(), isNull);
  });
}
