// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/viewer_format.dart';

void main() {
  test('fileNameOf keeps only the name, on Windows and POSIX paths', () {
    expect(fileNameOf(r'C:\a\b\work.oim.png'), 'work.oim.png');
    expect(fileNameOf('/home/x/work.oim.png'), 'work.oim.png');
    expect(fileNameOf('work.oim.png'), 'work.oim.png');
  });

  test('schemaVersionOf reads a string version, never a boolean marker', () {
    expect(schemaVersionOf({'oim': true, 'version': '1.26.0'}), 'v1.26.0');
    expect(schemaVersionOf({'oim': '1.22.0'}), 'v1.22.0');
    expect(schemaVersionOf({'oim': true}), '—');
  });
}
