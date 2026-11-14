/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// SVG at the door, paths inside. A 2.0 document carries no XML: an SVG is
// reduced to a list of path data, which every platform can draw without an
// XML parser or a sanitiser. Only a static profile is accepted -shapes and
// groups- and anything else is refused with its reason, never half-read.

export type PathEntry = {
  d: string;
  fillRule?: "evenodd";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cap?: "round" | "square";
  join?: "round" | "bevel";
  opacity?: number;
  transform?: number[];
};

export type SvgPaths = { viewBox: number[]; paths: PathEntry[] };
export type SvgResult = { ok: true; value: SvgPaths } | { ok: false; reason: string };

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const CONTAINERS = new Set(["svg", "g"]);
/** Text for people, with nothing to draw. Its content is skipped. */
const SILENT = new Set(["title", "desc", "metadata"]);

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

const numbersIn = (text: string): number[] => (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);

function parseTransform(text: string): Matrix | null {
  let matrix = IDENTITY;
  const calls = [...text.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)];
  if (calls.length === 0 && text.trim() !== "") return null;
  for (const [, name, args] of calls) {
    const n = numbersIn(args);
    let next: Matrix;
    if (name === "matrix" && n.length === 6) next = n as Matrix;
    else if (name === "translate" && n.length >= 1) next = [1, 0, 0, 1, n[0], n[1] ?? 0];
    else if (name === "scale" && n.length >= 1) next = [n[0], 0, 0, n[1] ?? n[0], 0, 0];
    else if (name === "rotate" && n.length >= 1) {
      const r = (n[0] * Math.PI) / 180;
      const turn: Matrix = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      next = n.length >= 3 ? multiply(multiply([1, 0, 0, 1, n[1], n[2]], turn), [1, 0, 0, 1, -n[1], -n[2]]) : turn;
    } else if (name === "skewX" && n.length === 1) next = [1, 0, Math.tan((n[0] * Math.PI) / 180), 1, 0, 0];
    else if (name === "skewY" && n.length === 1) next = [1, Math.tan((n[0] * Math.PI) / 180), 0, 1, 0, 0];
    else return null;
    matrix = multiply(matrix, next);
  }
  return matrix;
}

type Attrs = Record<string, string>;

function attributesOf(text: string): Attrs {
  const attrs: Attrs = {};
  for (const [, name, , double, single] of text.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[name] = double ?? single ?? "";
  }
  return attrs;
}

const HORIZONTAL = new Set(["x", "width", "cx", "rx", "x1", "x2"]);
const VERTICAL = new Set(["y", "height", "cy", "ry", "y1", "y2"]);

/** A length; a percentage is of the viewBox, as SVG resolves it (r: of its normalised diagonal). */
const numIn = (attrs: Attrs, name: string, viewBox?: number[]): number => {
  const raw = attrs[name] ?? "0";
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  if (!raw.trim().endsWith("%") || !viewBox) return value;
  const [w, h] = [viewBox[2], viewBox[3]];
  const ref = HORIZONTAL.has(name) ? w : VERTICAL.has(name) ? h : Math.sqrt((w * w + h * h) / 2);
  return (value / 100) * ref;
};

/**
 * A layer 1.x drew from SVG markup: the `svg` type, or an old library icon created
 * as `geo` with the SVG in its content. Its strokeColor tints the drawing.
 */
export function drawsMarkup(slot: { type?: unknown; raw: { content?: unknown } }): boolean {
  if (slot.type === "svg") return true;
  const content = slot.raw.content;
  const values = typeof content === "string" ? [content] : content && typeof content === "object" ? Object.values(content) : [];
  return values.some((v) => typeof v === "string" && /<svg/i.test(v));
}

/** The path data of a basic shape. */
function shapeToPath(tag: string, a: Attrs, vb?: number[]): string | null {
  const num = (attrs: Attrs, name: string) => numIn(attrs, name, vb);
  if (tag === "path") return a.d?.trim() || null;
  if (tag === "rect") {
    const [x, y, w, h] = [num(a, "x"), num(a, "y"), num(a, "width"), num(a, "height")];
    if (!(w > 0) || !(h > 0)) return null;
    let rx = a.rx !== undefined ? num(a, "rx") : a.ry !== undefined ? num(a, "ry") : 0;
    let ry = a.ry !== undefined ? num(a, "ry") : rx;
    rx = Math.min(rx, w / 2);
    ry = Math.min(ry, h / 2);
    if (!(rx > 0) || !(ry > 0)) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    return (
      `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}` +
      `A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}` +
      `A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
    );
  }
  if (tag === "circle" || tag === "ellipse") {
    const [cx, cy] = [num(a, "cx"), num(a, "cy")];
    const rx = tag === "circle" ? num(a, "r") : num(a, "rx");
    const ry = tag === "circle" ? rx : num(a, "ry");
    if (!(rx > 0) || !(ry > 0)) return null;
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  if (tag === "line") return `M${num(a, "x1")} ${num(a, "y1")}L${num(a, "x2")} ${num(a, "y2")}`;
  const points = numbersIn(a.points ?? "");
  if (points.length < 4 || points.length % 2 !== 0) return null;
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`;
  return tag === "polygon" ? `${d}Z` : d;
}

// Presentation attributes that a child inherits from its group.
const INHERITED = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule"] as const;

function refusal(name: string, attrs: Attrs): string | null {
  for (const key of Object.keys(attrs)) {
    const lower = key.toLowerCase();
    if (lower === "style") return `<${name}> carries a style attribute`;
    if (lower.startsWith("on")) return `<${name}> carries an event handler (${key})`;
    if (lower === "href" || lower.endsWith(":href")) return `<${name}> carries a reference (${key})`;
  }
  for (const key of ["fill", "stroke"]) {
    if (/url\s*\(/i.test(attrs[key] ?? "")) return `<${name}> paints with a reference (${key})`;
  }
  return null;
}

export function svgToPaths(xml: unknown): SvgResult {
  if (typeof xml !== "string" || xml.trim() === "") return { ok: false, reason: "not an SVG string" };
  const source = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");

  const paths: PathEntry[] = [];
  const stack: { name: string; matrix: Matrix; attrs: Attrs }[] = [];
  let viewBox: number[] | undefined;
  let silent = 0;
  let sawSvg = false;

  for (const [, closing, name, rest, selfClosing] of source.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    if (SILENT.has(name)) {
      if (closing) silent--;
      else if (!selfClosing) silent++;
      continue;
    }
    if (silent > 0) continue;
    if (closing) {
      stack.pop();
      continue;
    }
    if (!CONTAINERS.has(name) && !SHAPES.has(name)) return { ok: false, reason: `<${name}> is outside the static profile` };

    const attrs = attributesOf(rest);
    const refused = refusal(name, attrs);
    if (refused) return { ok: false, reason: refused };

    const parent = stack[stack.length - 1];
    const own = attrs.transform === undefined ? IDENTITY : parseTransform(attrs.transform);
    if (!own) return { ok: false, reason: `<${name}> has a transform that cannot be read` };
    const matrix = parent ? multiply(parent.matrix, own) : own;
    const inherited: Attrs = { ...(parent?.attrs ?? {}) };
    for (const key of INHERITED) if (attrs[key] !== undefined) inherited[key] = attrs[key];

    if (name === "svg" && !sawSvg) {
      sawSvg = true;
      const box = numbersIn(attrs.viewBox ?? "");
      const [w, h] = [Number.parseFloat(attrs.width ?? ""), Number.parseFloat(attrs.height ?? "")];
      if (box.length === 4) viewBox = box;
      else if (w > 0 && h > 0 && !/%/.test(`${attrs.width}${attrs.height}`)) viewBox = [0, 0, w, h];
    }

    if (SHAPES.has(name)) {
      const d = shapeToPath(name, attrs, viewBox);
      if (!d) continue;
      const entry: PathEntry = { d };
      // SVG fills in black when nothing says otherwise; `none` is written out.
      const fill = inherited.fill ?? "black";
      if (fill !== "none") entry.fill = fill;
      const stroke = inherited.stroke;
      if (stroke && stroke !== "none") {
        entry.stroke = stroke;
        const width = Number.parseFloat(inherited["stroke-width"] ?? "1");
        entry.strokeWidth = Number.isFinite(width) ? width : 1;
        const cap = inherited["stroke-linecap"];
        const join = inherited["stroke-linejoin"];
        if (cap === "round" || cap === "square") entry.cap = cap;
        if (join === "round" || join === "bevel") entry.join = join;
      }
      if (inherited["fill-rule"] === "evenodd") entry.fillRule = "evenodd";
      const opacity = Number.parseFloat(attrs.opacity ?? "");
      if (Number.isFinite(opacity) && opacity < 1) entry.opacity = Math.max(0, opacity);
      if (matrix.some((v, i) => Math.abs(v - IDENTITY[i]) > 1e-9)) entry.transform = matrix.map((v) => Number(v.toFixed(6)));
      paths.push(entry);
    }
    if (CONTAINERS.has(name) && !selfClosing) stack.push({ name, matrix, attrs: inherited });
  }

  if (!sawSvg) return { ok: false, reason: "no <svg> element" };
  if (!viewBox) return { ok: false, reason: "the <svg> declares no viewBox nor a size in units" };
  if (paths.length === 0) return { ok: false, reason: "nothing to draw" };
  return { ok: true, value: { viewBox, paths } };
}
