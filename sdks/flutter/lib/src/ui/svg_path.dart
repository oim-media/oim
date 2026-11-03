/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:math' as math;
import 'dart:ui';

/// Parses an SVG path data string (`d`) into a Flutter [Path].
///
/// Supported commands:
/// M, m (moveto)
/// L, l, H, h, V, v (lineto)
/// C, c, S, s (cubic bezier)
/// Q, q, T, t (quadratic bezier)
/// A, a (elliptical arc)
/// Z, z (closepath)
Path parseSvgPath(String d) {
  final path = Path();
  final tokenRegex = RegExp(
    r'([a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)',
    caseSensitive: false,
  );

  final matches = tokenRegex.allMatches(d);
  final tokens = <String>[];
  for (final m in matches) {
    tokens.add(m.group(0)!);
  }

  var i = 0;
  String currentCmd = '';
  double curX = 0;
  double curY = 0;
  double startX = 0;
  double startY = 0;
  double lastCtrlX = 0;
  double lastCtrlY = 0;

  bool isCmd(String token) => RegExp(r'^[a-df-z]$', caseSensitive: false).hasMatch(token);

  double nextNum() {
    if (i >= tokens.length) return 0.0;
    final token = tokens[i++];
    return double.tryParse(token) ?? 0.0;
  }

  while (i < tokens.length) {
    var token = tokens[i];
    if (isCmd(token)) {
      currentCmd = token;
      i++;
    }

    final isRel = currentCmd.toLowerCase() == currentCmd;
    final cmd = currentCmd.toUpperCase();

    switch (cmd) {
      case 'M':
        final x = nextNum() + (isRel ? curX : 0.0);
        final y = nextNum() + (isRel ? curY : 0.0);
        curX = x;
        curY = y;
        startX = x;
        startY = y;
        path.moveTo(x, y);
        // Subsequent coordinate pairs are treated as implicit Lineto (L / l)
        currentCmd = isRel ? 'l' : 'L';
        break;

      case 'L':
        final x = nextNum() + (isRel ? curX : 0.0);
        final y = nextNum() + (isRel ? curY : 0.0);
        path.lineTo(x, y);
        curX = x;
        curY = y;
        break;

      case 'H':
        final x = nextNum() + (isRel ? curX : 0.0);
        path.lineTo(x, curY);
        curX = x;
        break;

      case 'V':
        final y = nextNum() + (isRel ? curY : 0.0);
        path.lineTo(curX, y);
        curY = y;
        break;

      case 'C':
        final x1 = nextNum() + (isRel ? curX : 0.0);
        final y1 = nextNum() + (isRel ? curY : 0.0);
        final x2 = nextNum() + (isRel ? curX : 0.0);
        final y2 = nextNum() + (isRel ? curY : 0.0);
        final x = nextNum() + (isRel ? curX : 0.0);
        final y = nextNum() + (isRel ? curY : 0.0);
        path.cubicTo(x1, y1, x2, y2, x, y);
        lastCtrlX = x2;
        lastCtrlY = y2;
        curX = x;
        curY = y;
        break;

      case 'S':
        // Smooth cubic bezier
        double x1;
        double y1;
        final prevWasC = (currentCmd == 'C' || currentCmd == 'c' || currentCmd == 'S' || currentCmd == 's');
        if (prevWasC) {
          x1 = 2 * curX - lastCtrlX;
          y1 = 2 * curY - lastCtrlY;
        } else {
          x1 = curX;
          y1 = curY;
        }
        final x2 = nextNum() + (isRel ? curX : 0.0);
        final y2 = nextNum() + (isRel ? curY : 0.0);
        final x = nextNum() + (isRel ? curX : 0.0);
        final y = nextNum() + (isRel ? curY : 0.0);
        path.cubicTo(x1, y1, x2, y2, x, y);
        lastCtrlX = x2;
        lastCtrlY = y2;
        curX = x;
        curY = y;
        break;

      case 'Q':
        final x1 = nextNum() + (isRel ? curX : 0.0);
        final y1 = nextNum() + (isRel ? curY : 0.0);
        final x = nextNum() + (isRel ? curX : 0.0);
        final y = nextNum() + (isRel ? curY : 0.0);
        path.quadraticBezierTo(x1, y1, x, y);
        lastCtrlX = x1;
        lastCtrlY = y1;
        curX = x;
        curY = y;
        break;

      case 'T':
        // Smooth quadratic bezier
        double x1;
        double y1;
        final prevWasQ = (currentCmd == 'Q' || currentCmd == 'q' || currentCmd == 'T' || currentCmd == 't');
        if (prevWasQ) {
          x1 = 2 * curX - lastCtrlX;
          y1 = 2 * curY - lastCtrlY;
        } else {
          x1 = curX;
          y1 = curY;
        }
        final x = nextNum() + (isRel ? curX : 0.0);
        final y = nextNum() + (isRel ? curY : 0.0);
        path.quadraticBezierTo(x1, y1, x, y);
        lastCtrlX = x1;
        lastCtrlY = y1;
        curX = x;
        curY = y;
        break;

      case 'A':
        final rx = nextNum().abs();
        final ry = nextNum().abs();
        final angle = nextNum() * math.pi / 180.0;
        final largeArc = nextNum() != 0;
        final sweep = nextNum() != 0;
        final x = nextNum() + (isRel ? curX : 0.0);
        final y = nextNum() + (isRel ? curY : 0.0);

        if (rx == 0 || ry == 0) {
          path.lineTo(x, y);
        } else {
          path.arcToPoint(
            Offset(x, y),
            radius: Radius.elliptical(rx, ry),
            rotation: angle,
            largeArc: largeArc,
            clockwise: sweep,
          );
        }
        curX = x;
        curY = y;
        break;

      case 'Z':
        path.close();
        curX = startX;
        curY = startY;
        break;

      default:
        // Ignore unrecognized command
        i++;
        break;
    }
  }

  return path;
}
