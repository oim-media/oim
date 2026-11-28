/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:math' as math;
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

  /// Turns reversed polystars (`d: 3`) forward. The lottie package bends the
  /// rounded corners of a reversed star the wrong way, so its points break.
  /// shortcut: forward winding moves a trim path's start; harmless without `tm`, fix upstream if one breaks.
  static String forwardPolystars(String json) {
    if (!json.contains('"sr"')) return json;
    final Object? root;
    try {
      root = jsonDecode(json);
    } catch (_) {
      return json;
    }
    var changed = false;
    void walk(Object? node) {
      if (node is List) {
        node.forEach(walk);
      } else if (node is Map) {
        if (node['ty'] == 'sr') {
          if (node['d'] == 3) {
            node['d'] = 1;
            changed = true;
          }
          // lottie-web sizes a rounded point's handles 2*PI*r / (4*points); this port uses 0.47829*r
          // whatever the count, so with 8 points the curve overshoots into notches.
          final pts = _maxPoints(node['pt']);
          if (pts > 0 && (node['sy'] ?? 1) == 1) {
            final f = math.pi / (2 * pts) / 0.47829;
            _scaleProp(node['is'], f);
            _scaleProp(node['os'], f);
            changed = true;
          }
        }
        node.values.forEach(walk);
      }
    }

    walk(root);
    return changed ? jsonEncode(root) : json;
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
    // The system's "remove animations" counts too (web: prefers-reduced-motion).
    final shouldAnimate = !disableAnimations && !(MediaQuery.maybeDisableAnimationsOf(context) ?? false);
    final bytes = Uint8List.fromList(utf8.encode(forwardPolystars(lottieString)));

    return Lottie.memory(
      bytes,
      // Still, it rests on the middle frame like the web: frame 0 is empty in most Lotties.
      // shortcut: progress 0.5 can be one frame past the web's floor((total-1)/2); exact needs the composition.
      controller: shouldAnimate ? null : const AlwaysStoppedAnimation(0.5),
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

double _maxPoints(Object? prop) {
  if (prop is! Map) return 0;
  final k = prop['k'];
  if (k is num) return k.toDouble();
  var max = 0.0;
  if (k is List) {
    for (final kf in k) {
      final s = kf is Map ? kf['s'] : null;
      final n = s is List && s.isNotEmpty && s.first is num ? (s.first as num).toDouble() : (s is num ? s.toDouble() : 0.0);
      if (n > max) max = n;
    }
  }
  return max;
}

void _scaleProp(Object? prop, double f) {
  if (prop is! Map) return;
  final k = prop['k'];
  if (k is num) {
    prop['k'] = k * f;
  } else if (k is List) {
    for (final kf in k) {
      if (kf is! Map) continue;
      final s = kf['s'];
      if (s is num) kf['s'] = s * f;
      if (s is List) kf['s'] = [for (final v in s) v is num ? v * f : v];
    }
  }
}
