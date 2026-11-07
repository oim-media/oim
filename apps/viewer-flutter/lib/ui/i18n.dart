// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Interface language: Spanish when the system is in Spanish, English otherwise,
// like the Tauri viewer (apps/viewer-desktop/src/ui/dropzone.ts detectUiLang).
import 'dart:ui' as ui;

bool uiSpanish = ui.PlatformDispatcher.instance.locale.languageCode == 'es';

String t(String es, String en) => uiSpanish ? es : en;
