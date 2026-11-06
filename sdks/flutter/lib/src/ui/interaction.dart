// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// How a layer appears and disappears (`style.reveal`, core/src/reveal.ts) and
// how an interactive layer answers the pointer (`states`, the web's
// engines/states.ts `bindStates`).

import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'actions.dart';

/// The web's `easingToCss` as a Flutter curve: a cubic-bezier list or a CSS name.
Curve curveOf(Object? easing, Curve fallback) {
  if (easing is List && easing.length == 4) {
    final v = easing.map((e) => (e as num).toDouble()).toList();
    return Cubic(v[0], v[1], v[2], v[3]);
  }
  switch (easing) {
    case 'linear':
      return Curves.linear;
    case 'ease':
      return Curves.ease;
    case 'ease-in':
      return Curves.easeIn;
    case 'ease-out':
      return Curves.easeOut;
    case 'ease-in-out':
      return Curves.easeInOut;
  }
  return fallback;
}

/// Shows or hides a layer with its `reveal` (fade, slide-*, scale), or the
/// default 300 ms in / 250 ms out fade. Hidden, it takes no pointer.
class OimReveal extends StatefulWidget {
  final bool visible;
  final Map? reveal;
  /// Canvas width: the slides move 4 % of it, as the web's 4cqw.
  final double canvasWidth;
  final bool disableAnimations;
  final Widget child;
  const OimReveal({
    super.key,
    required this.visible,
    required this.reveal,
    required this.canvasWidth,
    required this.disableAnimations,
    required this.child,
  });

  @override
  State<OimReveal> createState() => _OimRevealState();
}

class _OimRevealState extends State<OimReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, value: widget.visible ? 1 : 0);

  @override
  void didUpdateWidget(OimReveal old) {
    super.didUpdateWidget(old);
    if (old.visible == widget.visible) return;
    final r = widget.reveal;
    final ms = (r?['duration'] as num?)?.toInt() ?? (widget.visible ? 300 : 250);
    final target = widget.visible ? 1.0 : 0.0;
    if (widget.disableAnimations || ms <= 0) {
      _c.value = target;
      return;
    }
    // From wherever a cancelled reveal left the layer, as the web does.
    _c.animateTo(target,
        duration: Duration(milliseconds: ms), curve: curveOf(r?['easing'], r == null ? Curves.ease : Curves.easeOut));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Offset _from() {
    final d = 0.04 * widget.canvasWidth;
    switch (widget.reveal?['effect']) {
      case 'slide-up':
        return Offset(0, d);
      case 'slide-down':
        return Offset(0, -d);
      case 'slide-left':
        return Offset(d, 0);
      case 'slide-right':
        return Offset(-d, 0);
    }
    return Offset.zero;
  }

  @override
  Widget build(BuildContext context) {
    final scaleFx = widget.reveal?['effect'] == 'scale';
    final from = _from();
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final v = _c.value;
        if (v == 0) return IgnorePointer(child: Opacity(opacity: 0, child: child));
        Widget w = Opacity(opacity: v.clamp(0.0, 1.0), child: child);
        if (from != Offset.zero) w = Transform.translate(offset: from * (1 - v), child: w);
        if (scaleFx) w = Transform.scale(scale: 0.92 + 0.08 * v, child: w);
        return v < 1 ? IgnorePointer(child: w) : w;
      },
    );
  }
}

/// An interactive layer: `states.hover` styles and actions while the pointer
/// is over it (undone on leaving), `states.active` actions on tap (never undone).
class OimInteractive extends StatefulWidget {
  final Map states;
  final void Function(List actions) onHover;
  final VoidCallback onLeave;
  final void Function(List actions) onTap;
  final Widget child;
  const OimInteractive({
    super.key,
    required this.states,
    required this.onHover,
    required this.onLeave,
    required this.onTap,
    required this.child,
  });

  @override
  State<OimInteractive> createState() => _OimInteractiveState();
}

class _OimInteractiveState extends State<OimInteractive> {
  bool _hovered = false;

  Map? get _hover => widget.states['hover'] is Map ? widget.states['hover'] as Map : null;

  List _actionsOf(Map? state) => state?['actions'] is List ? state!['actions'] as List : const [];

  void _enter() {
    setState(() => _hovered = true);
    final a = _actionsOf(_hover);
    if (a.isNotEmpty) widget.onHover(a);
  }

  void _exit() {
    setState(() => _hovered = false);
    if (_actionsOf(_hover).isNotEmpty) widget.onLeave();
  }

  @override
  Widget build(BuildContext context) {
    final h = _hovered ? _hover : null;
    final dur = Duration(
        milliseconds: (((_hover?['transitionDuration'] as num?)?.toDouble() ?? 0.2) * 1000).round());
    final scale = h?['scale'] is num ? scaleAsFactor(h!['scale'] as num) : 1.0;
    final turns = h?['rotation'] is num ? (h!['rotation'] as num) / 360 : 0.0;
    final opacity = h?['opacity'] is num ? ((h!['opacity'] as num) / 100).clamp(0.0, 1.0) : 1.0;
    final active = widget.states['active'] is Map ? widget.states['active'] as Map : null;
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => _enter(),
      onExit: (_) => _exit(),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => widget.onTap(_actionsOf(active)),
        // WCAG 2.5.8: never a touch target under 24x24.
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
          child: AnimatedOpacity(
            opacity: opacity.toDouble(),
            duration: dur,
            child: AnimatedRotation(
              turns: turns.toDouble(),
              duration: dur,
              child: AnimatedScale(scale: math.max(0, scale), duration: dur, child: widget.child),
            ),
          ),
        ),
      ),
    );
  }
}
