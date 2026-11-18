/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A drawn texture paint (dots, lines, rings or grain) as CSS background layers.
 * The same drawing the editor shows: the editor and every player read
 * this one function. The paint's opacity is the colour's alpha, not the node's.
 */

export type DrawnTexture = { type: string; color?: string; angle?: number; crossed?: boolean; thickness?: number; size?: number };

// 1.x files and the editor name the kinds in Spanish; 2.0 reads both.
const KIND: Record<string, "dots" | "lines" | "rings" | "grain"> = {
  dots: "dots", puntos: "dots",
  lines: "lines", lineas: "lines",
  rings: "rings", anillos: "rings",
  grain: "grain", grano: "grain",
};

const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d.,\s%]+\)$/;

/** A hex or rgb() colour at an alpha; anything else is white, since it ends up inside CSS and SVG. */
export function colorAtAlpha(color: string | undefined, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const c = (color ?? "").trim();
  if (!SAFE_COLOR.test(c)) return `rgba(255, 255, 255, ${a})`;
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = [...hex].map((h) => h + h).join("");
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) || 0;
    return `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${a})`;
  }
  const [r = "0", g = "0", b = "0"] = c.replace(/rgba?\(|\)/g, "").split(",").map((s) => s.trim());
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** The analogue-grain tile, 128 px: the noise is the alpha and the colour fills it. */
export function grainTileSvg(alpha: number, color = "#ffffff"): string {
  const a = Math.max(0, Math.min(1, alpha));
  const flood = SAFE_COLOR.test(color.trim()) ? color.trim() : "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="n"/><feColorMatrix in="n" type="luminanceToAlpha" result="a"/><feFlood flood-color="${flood}"/><feComposite in2="a" operator="in"/></filter><rect width="128" height="128" filter="url(#g)" opacity="${a}"/></svg>`;
}

/**
 * The texture's background image and size; undefined for an unknown kind.
 * `len` turns a canvas length into CSS (a player scales it with the canvas).
 */
export function textureCss(
  t: DrawnTexture,
  opacity = 0.2,
  len: (px: number) => string = (px) => `${px}px`,
): { backgroundImage: string; backgroundSize: string } | undefined {
  const kind = KIND[t.type];
  if (!kind) return undefined;
  const color = colorAtAlpha(t.color ?? "#ffffff", opacity);
  const size = Math.max(2, t.size || 20);
  if (kind === "dots") {
    const r = len(Math.max(0.5, t.thickness ?? 2));
    return { backgroundImage: `radial-gradient(circle, ${color} ${r}, transparent ${r})`, backgroundSize: `${len(size)} ${len(size)}` };
  }
  if (kind === "grain") {
    const svg = grainTileSvg(opacity, t.color);
    return { backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, backgroundSize: `${len(128)} ${len(128)}` };
  }
  const width = Math.max(0.5, t.thickness ?? 1);
  if (kind === "rings") {
    const start = Math.max(0, size - width);
    return {
      backgroundImage: `repeating-radial-gradient(circle, transparent 0, transparent ${len(start)}, ${color} ${len(start)}, ${color} ${len(size)}, transparent ${len(size + 1)})`,
      backgroundSize: "100% 100%",
    };
  }
  // Lines: 0° and 270° are written 180° and 90°, so the gradient starts at a visible edge.
  const cssAngle = (deg: number) => {
    const a = ((deg % 180) + 180) % 180;
    return a === 0 ? 180 : a;
  };
  const lines = (deg: number) =>
    `repeating-linear-gradient(${cssAngle(deg)}deg, ${color} 0px, ${color} ${len(width)}, transparent ${len(width)}, transparent ${len(size)})`;
  const angle = t.angle ?? 0;
  return t.crossed
    ? { backgroundImage: `${lines(angle)}, ${lines(angle + 90)}`, backgroundSize: "100% 100%, 100% 100%" }
    : { backgroundImage: lines(angle), backgroundSize: "100% 100%" };
}
