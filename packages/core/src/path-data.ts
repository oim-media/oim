/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SVG path data parser shared by the player and the editor.
 *
 * CANONICAL: one parser for every mask outline. Ported from the editor's
 * frame-svg.ts; do not fork it. Quadratic curves and arcs become cubics so a
 * single affine map stays exact.
 */

export type PathOp = { cmd: "M" | "L" | "C" | "Z"; args: number[] };

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const ARG_COUNT: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** SVG 1.1 F.6: an elliptical arc as cubic curves, or null when it is a straight line. */
function arcToCubics(
  x1: number, y1: number, rx0: number, ry0: number, angleDeg: number,
  largeArc: number, sweep: number, x2: number, y2: number,
): number[][] | null {
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return null;
  const phi = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const angle = (ax: number, ay: number, bx: number, by: number) => {
    const k = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
    const a = Math.acos(Math.max(-1, Math.min(1, k)));
    return ax * by - ay * bx < 0 ? -a : a;
  };
  const theta1 = angle(1, 0, ux, uy);
  let dTheta = angle(ux, uy, vx, vy);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2) - 1e-9));
  const delta = dTheta / segments;
  const k = (4 / 3) * Math.tan(delta / 4);
  const point = (t: number) => [
    cx + rx * cos * Math.cos(t) - ry * sin * Math.sin(t),
    cy + rx * sin * Math.cos(t) + ry * cos * Math.sin(t),
  ];
  const tangent = (t: number) => [
    -rx * cos * Math.sin(t) - ry * sin * Math.cos(t),
    -rx * sin * Math.sin(t) + ry * cos * Math.cos(t),
  ];
  const curves: number[][] = [];
  for (let s = 0; s < segments; s++) {
    const ta = theta1 + s * delta;
    const tb = ta + delta;
    const pa = point(ta);
    const pb = point(tb);
    const da = tangent(ta);
    const db = tangent(tb);
    curves.push([pa[0] + k * da[0], pa[1] + k * da[1], pb[0] - k * db[0], pb[1] - k * db[1], pb[0], pb[1]]);
  }
  return curves;
}

/** Normalizes M L H V C Q S T A Z (absolute and relative) to absolute M L C Z. null when malformed. */
export function normalizePathData(d: string): PathOp[] | null {
  // SVG requires the first command to be a moveto; "" and "L10 10" are not paths.
  if (!/^\s*[Mm]/.test(d)) return null;
  const ops: PathOp[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let lastType = "";
  let lastCtrl: [number, number] = [0, 0];

  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const readNumber = (): number | null => {
    skip();
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(d);
    if (!m) return null;
    i = NUMBER.lastIndex;
    return Number(m[0]);
  };
  const readFlag = (): number | null => {
    skip();
    if (d[i] !== "0" && d[i] !== "1") return null;
    return Number(d[i++]);
  };

  for (;;) {
    skip();
    if (i >= d.length) break;
    if (/[A-Za-z]/.test(d[i])) {
      if (!"MmLlHhVvCcSsQqTtAaZz".includes(d[i])) return null;
      cmd = d[i++];
    } else if (cmd === "" || cmd === "Z" || cmd === "z") {
      return null;
    } else if (cmd === "M") {
      cmd = "L"; // extra pairs after a moveto are lineto
    } else if (cmd === "m") {
      cmd = "l";
    }

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    const a: number[] = [];
    for (let k = 0; k < ARG_COUNT[upper]; k++) {
      const v = upper === "A" && (k === 3 || k === 4) ? readFlag() : readNumber();
      if (v === null) return null;
      a.push(v);
    }
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;

    switch (upper) {
      case "Z":
        ops.push({ cmd: "Z", args: [] });
        x = startX;
        y = startY;
        lastType = "";
        break;
      case "M":
        x = a[0] + ox;
        y = a[1] + oy;
        startX = x;
        startY = y;
        ops.push({ cmd: "M", args: [x, y] });
        lastType = "";
        break;
      case "L":
        x = a[0] + ox;
        y = a[1] + oy;
        ops.push({ cmd: "L", args: [x, y] });
        lastType = "";
        break;
      case "H":
        x = a[0] + ox;
        ops.push({ cmd: "L", args: [x, y] });
        lastType = "";
        break;
      case "V":
        y = a[0] + oy;
        ops.push({ cmd: "L", args: [x, y] });
        lastType = "";
        break;
      case "C": {
        const c1 = [a[0] + ox, a[1] + oy];
        const c2 = [a[2] + ox, a[3] + oy];
        const end = [a[4] + ox, a[5] + oy];
        ops.push({ cmd: "C", args: [...c1, ...c2, ...end] });
        lastCtrl = [c2[0], c2[1]];
        lastType = "C";
        [x, y] = end;
        break;
      }
      case "S": {
        const c1 = lastType === "C" ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
        const c2 = [a[0] + ox, a[1] + oy];
        const end = [a[2] + ox, a[3] + oy];
        ops.push({ cmd: "C", args: [...c1, ...c2, ...end] });
        lastCtrl = [c2[0], c2[1]];
        lastType = "C";
        [x, y] = end;
        break;
      }
      case "Q":
      case "T": {
        const q = upper === "Q"
          ? [a[0] + ox, a[1] + oy]
          : lastType === "Q" ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
        const end = upper === "Q" ? [a[2] + ox, a[3] + oy] : [a[0] + ox, a[1] + oy];
        ops.push({
          cmd: "C",
          args: [
            x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y),
            end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1]),
            end[0], end[1],
          ],
        });
        lastCtrl = [q[0], q[1]];
        lastType = "Q";
        [x, y] = end;
        break;
      }
      case "A": {
        const end = [a[5] + ox, a[6] + oy];
        const curves = arcToCubics(x, y, a[0], a[1], a[2], a[3], a[4], end[0], end[1]);
        if (curves) for (const c of curves) ops.push({ cmd: "C", args: c });
        else ops.push({ cmd: "L", args: end });
        lastType = "";
        [x, y] = end;
        break;
      }
    }
  }
  return ops;
}

/** Applies an affine-style point map to a path and returns absolute path data (0.01 precision), or null. */
export function transformPathData(
  d: string,
  map: (x: number, y: number) => [number, number],
): string | null {
  const ops = normalizePathData(d);
  if (!ops) return null;
  const fmt = (n: number) => {
    const r = Math.round(n * 100) / 100;
    return String(r === 0 ? 0 : r);
  };
  return ops
    .map(({ cmd, args }) => {
      if (cmd === "Z") return "Z";
      const nums: string[] = [];
      for (let k = 0; k < args.length; k += 2) {
        const [px, py] = map(args[k], args[k + 1]);
        nums.push(fmt(px), fmt(py));
      }
      return cmd + nums.join(" ");
    })
    .join("");
}
