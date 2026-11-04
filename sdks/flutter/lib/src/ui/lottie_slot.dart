/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Renders embedded vector Lottie animations for slots with `type: "lottie"`.
///
/// Follows canonical OIM specifications:
/// - Reads vector animation JSON from `slot.content` (plain string, localized map, or Map).
/// - Enforces offline safety: external URLs are rejected.
/// - Supports on-demand loading, loops by default, and respects `allowLottie` and `disableAnimations`.
class LottieSlot extends StatelessWidget {
  final Map<String, dynamic> slot;
  final Map<String, dynamic> style;
  final String language;
  final bool allowLottie;
  final bool disableAnimations;

  const LottieSlot({
    super.key,
    required this.slot,
    required this.style,
    this.language = 'es',
    this.allowLottie = true,
    this.disableAnimations = false,
  });

  /// Extracts the Lottie JSON string or data bytes from slot content.
  static String? extractLottieJson(dynamic content, String language) {
    if (content == null) return null;

    dynamic raw;
    if (content is Map) {
      final isLocalizedMap = content.containsKey(language) ||
          content.containsKey('*') ||
          content.containsKey('es') ||
          content.containsKey('en');
      if (isLocalizedMap) {
        raw = content[language] ??
            content['*'] ??
            content['en'] ??
            content['es'] ??
            (content.isNotEmpty ? content.values.first : null);
      } else {
        // Direct Lottie animation JSON map
        raw = content;
      }
    } else {
      raw = content;
    }

    if (raw == null) return null;

    if (raw is Map) {
      if (raw.isEmpty) return null;
      try {
        return jsonEncode(raw);
      } catch (e) {
        return null;
      }
    }

    if (raw is String) {
      final trimmed = raw.trim();
      if (trimmed.isEmpty) return null;

      // External URLs are forbidden for offline security and determinism
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (kDebugMode) {
          print('[OimPlayer] External Lottie URLs are not supported for offline security.');
        }
        return null;
      }

      // Check data URI (data:application/json;base64,...)
      if (trimmed.startsWith('data:')) {
        final commaIdx = trimmed.indexOf(',');
        if (commaIdx != -1) {
          final meta = trimmed.substring(0, commaIdx);
          final payload = trimmed.substring(commaIdx + 1);
          if (meta.contains('base64')) {
            try {
              final bytes = base64Decode(payload);
              return utf8.decode(bytes);
            } catch (_) {
              return null;
            }
          } else {
            return Uri.decodeComponent(payload);
          }
        }
      }

      return trimmed;
    }

    return null;
  }

  /// Maps CSS object-fit to Flutter BoxFit.
  static BoxFit resolveBoxFit(dynamic rawFit) {
    if (rawFit is! String) return BoxFit.contain;
    switch (rawFit.toLowerCase().trim()) {
      case 'cover':
        return BoxFit.cover;
      case 'fill':
        return BoxFit.fill;
      case 'none':
        return BoxFit.none;
      case 'scale-down':
        return BoxFit.scaleDown;
      case 'contain':
      default:
        return BoxFit.contain;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!allowLottie) {
      return const SizedBox.shrink();
    }

    final lottieString = extractLottieJson(slot['content'], language);
    if (lottieString == null || lottieString.isEmpty) {
      return const SizedBox.shrink();
    }

    final fit = resolveBoxFit(style['objectFit']);
    final shouldAnimate = !disableAnimations;
    final bytes = Uint8List.fromList(utf8.encode(lottieString));

    return Lottie.memory(
      bytes,
      animate: shouldAnimate,
      repeat: shouldAnimate,
      fit: fit,
      errorBuilder: (context, error, stackTrace) {
        if (kDebugMode) {
          print('[OimPlayer] Error decoding Lottie animation: $error');
        }
        return const SizedBox.shrink();
      },
    );
  }
}
