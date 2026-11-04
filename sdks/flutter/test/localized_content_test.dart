// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Same cases as resolveContent in @oim-media/player-oim (localizedEntries.ts).
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';

void main() {
  test('the default language is English', () {
    expect(oimDefaultLanguage, 'en');
  });
  test('own language wins', () {
    expect(resolveContent({'es': 'Hola', 'en': 'Hello'}, 'es'), 'Hola');
  });
  test('a missing language falls back to en before es', () {
    expect(resolveContent({'es': 'Hola', 'en': 'Hello'}, 'fr'), 'Hello');
  });
  test('an empty translation falls back', () {
    expect(resolveContent({'es': '', 'en': 'Hello'}, 'es'), 'Hello');
  });
  test('language match ignores case', () {
    expect(resolveContent({'pt-BR': 'Olá'}, 'pt-br'), 'Olá');
  });
  test('with "*" an own key is final, even empty', () {
    expect(resolveContent({'*': 'img.png', 'en': ''}, 'en'), '');
    expect(resolveContent({'*': 'img.png', 'en': 'b.png'}, 'es'), 'img.png');
  });
  test('last resort is the first value', () {
    expect(resolveContent({'de': 'Hallo'}, 'fr'), 'Hallo');
    expect(resolveContent(null, 'fr'), '');
  });
}
