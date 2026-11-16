// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter/painting.dart';

// The viewer's palette (dark, zinc). Accent fill is white; amber only warns.
const kBg = Color(0xFF09090B);
const kBgCenter = Color(0xFF131317);
const kBorder = Color(0x14FFFFFF);
const kText = Color(0xFFF4F4F5);
const kTextSecondary = Color(0xFFA1A1AA);
// #8A8A93 on kBg is 5.8:1; the old #71717A was 4.1:1, under AA for small text.
const kTextMuted = Color(0xFF8A8A93);
const kChipBg = Color(0x0DFFFFFF);
const kChipBorder = Color(0x17FFFFFF);
const kTopBarBg = Color(0xE00E0E12);
const kDrawerBg = Color(0xEB101014);
const kTextSoft = Color(0xFFE4E4E7);
const kSigned = Color(0xFF38BDF8);
const kOk = Color(0xFF22C55E);
const kDanger = Color(0xFFEF4444);

// Type scale: four steps, each at least 1.15x the last (12/14/16/20 sp).
const kFontSmall = 12.0;
const kFontBody = 14.0;
const kFontTitle = 16.0;
const kFontHeading = 20.0;

// Android minimum touch target.
const kMinTarget = 48.0;

const kWarning = Color(0xFFF59E0B);
const kMono = TextStyle(fontFamily: 'Consolas', fontFamilyFallback: ['Menlo', 'monospace']);
