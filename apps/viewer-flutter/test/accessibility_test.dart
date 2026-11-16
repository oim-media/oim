// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/main.dart';

void main() {
  testWidgets('on a phone the top bar meets Android tap-target and label guidelines', (t) async {
    t.view.physicalSize = const Size(1080, 2400);
    t.view.devicePixelRatio = 2.625;
    addTearDown(t.view.reset);
    final handle = t.ensureSemantics();
    await t.pumpWidget(const OimViewerApp());
    await t.pump();

    await expectLater(t, meetsGuideline(androidTapTargetGuideline));
    await expectLater(t, meetsGuideline(labeledTapTargetGuideline));
    await expectLater(t, meetsGuideline(textContrastGuideline));
    // Icons only on a phone, with the label still read out.
    expect(find.text('Library'), findsNothing);
    for (final label in ['Library', 'Open']) {
      final size = t.getSize(find.bySemanticsLabel(label));
      expect(size.width, greaterThanOrEqualTo(48), reason: label);
      expect(size.height, greaterThanOrEqualTo(48), reason: label);
    }
    handle.dispose();
  });
}
