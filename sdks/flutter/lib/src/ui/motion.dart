// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// A layer's `style.animation`: structured keyframes, the loop presets and the
// hover presets, as the web player plays them (ImageEngine.ts and the
// `oim-loop-*` / `oim-hover-*` rules in render/styles.ts).

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/widgets.dart';
import 'keyframes.dart';

/// The loop presets as keyframes, with the web's default durations.
/// `glow` animates a text shadow on the web; it is not played here yet.
List<Map<String, dynamic>>? loopPresetKeyframes(String name, double d) {
  const io = 'ease-in-out';
  switch (name) {
    case 'pulse':
      return [
        {'t': 0, 's': 1, 'o': 1, 'e': io},
        {'t': d / 2, 's': 0.95, 'o': 0.8, 'e': io},
        {'t': d, 's': 1, 'o': 1},
      ];
    case 'float':
    case 'bounce':
      final dy = name == 'float' ? -6 : -8;
      return [
        {'t': 0, 'y': 0, 'e': io},
        {'t': d / 2, 'y': dy, 'e': io},
        {'t': d, 'y': 0},
      ];
    case 'spin':
      return [
        {'t': 0, 'r': 0},
        {'t': d, 'r': 360},
      ];
  }
  return null;
}

const _loopDefaults = {'pulse': 2.0, 'float': 3.0, 'bounce': 1.2, 'spin': 4.0};

class OimMotion extends StatefulWidget {
  final Map<String, dynamic> animation;
  final bool disableAnimations;
  final Widget child;
  const OimMotion({super.key, required this.animation, required this.disableAnimations, required this.child});

  @override
  State<OimMotion> createState() => _OimMotionState();
}

class _OimMotionState extends State<OimMotion> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  List<Map<String, dynamic>> _frames = const [];
  double _duration = 0;
  double _delay = 0;
  bool _hovered = false;
  Timer? _delayTimer;

  @override
  void initState() {
    super.initState();
    _setup();
  }

  @override
  void didUpdateWidget(OimMotion old) {
    super.didUpdateWidget(old);
    if (old.animation != widget.animation || old.disableAnimations != widget.disableAnimations) {
      _delayTimer?.cancel();
      _controller?.dispose();
      _controller = null;
      _setup();
    }
  }

  void _setup() {
    _frames = const [];
    if (widget.disableAnimations) return;
    final anim = widget.animation;
    final kfs = anim['keyframes'];
    final d = (anim['duration'] as num?)?.toDouble();
    _delay = 0;
    if (kfs is List && kfs.length >= 2) {
      _duration = (d == null || d == 0) ? 8 : d;
      if (_duration <= 0) return;
      _frames = kfs.cast<Map<String, dynamic>>();
      // `trigger: "action"` rests on the first keyframe until a play action (phase 2).
      if (anim['trigger'] == 'action') return;
    } else {
      final loop = anim['loop'];
      if (loop is! String || !_loopDefaults.containsKey(loop)) return;
      _duration = (d != null && d > 0) ? d : _loopDefaults[loop]!;
      _delay = (anim['delay'] as num?)?.toDouble() ?? 0;
      _frames = loopPresetKeyframes(loop, _duration)!;
    }
    final c = AnimationController(vsync: this, duration: Duration(microseconds: (_duration * 1e6).round()));
    _controller = c;
    // The CSS delay applies once; afterwards the loop repeats without it.
    if (_delay > 0) {
      _delayTimer = Timer(Duration(microseconds: (_delay * 1e6).round()), () {
        if (_controller == c) c.repeat();
      });
    } else {
      c.repeat();
    }
  }

  @override
  void dispose() {
    _delayTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  double get _time => (_controller?.value ?? 0) * _duration;

  Widget _paint(KeyframeState s, Widget child) {
    var w = child;
    if (s.b > 0) {
      w = ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: s.b, sigmaY: s.b, tileMode: TileMode.decal), child: w);
    }
    final o = s.o.clamp(0.0, 1.0);
    if (o < 1) w = Opacity(opacity: o, child: w);
    final m = Matrix4.identity()
      ..translateByDouble(s.x, s.y, 0, 1)
      ..rotateZ(s.r * math.pi / 180)
      ..scaleByDouble(s.s, s.s, 1, 1);
    return Transform(alignment: Alignment.center, transform: m, child: w);
  }

  Widget _hover(Widget child) {
    final kind = widget.animation['hover'];
    if (widget.disableAnimations || kind is! String || !const {'grow', 'shrink', 'lift'}.contains(kind)) return child;
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: _hovered ? 1 : 0),
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        child: child,
        builder: (context, k, c) {
          final scale = kind == 'grow' ? 1 + 0.08 * k : (kind == 'shrink' ? 1 - 0.08 * k : 1.0);
          final dy = kind == 'lift' ? -6 * k : 0.0;
          return Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..translateByDouble(0.0, dy, 0, 1)
              ..scaleByDouble(scale, scale, 1, 1),
            child: c,
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget w = widget.child;
    if (_frames.isNotEmpty) {
      final c = _controller;
      w = c == null
          ? _paint(sampleKeyframes(_frames, _duration, 0), w)
          : AnimatedBuilder(animation: c, child: w, builder: (_, child) => _paint(sampleKeyframes(_frames, _duration, _time), child!));
    }
    return _hover(w);
  }
}
