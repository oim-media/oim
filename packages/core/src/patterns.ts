/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isSafeCssColor, type DynamicColorRole } from "./dynamic-colors.js";

/**
 * El motor de PATRONES: teselas repetibles -nubes, rayas, puntos, estrellas-
 * que se pintan como fondo de una capa.
 *
 * No confundir con `generative/`, que es otra cosa: aquel es un catalogo de
 * generadores de composicion -mallas, blobs, degradados radiales- con esquema
 * de parametros y galeria propia. Este produce un SVG que se repite.
 *
 * Vivia en `player-oim/src/core/generativeEngine.ts` y el editor tenia la misma
 * funcion dentro de `utils.ts`, mezclada con ayudantes de ficheros y de Lottie.
 * Las dos implementaciones solo diferian en la DECLARACION de tipos, no en el
 * cuerpo -16 lineas, todas comentarios y dos campos opcionales-.
 */

export interface GenerativeEngineOptions {
  type: string;
  bgColor: string;
  fgColor: string;
  colors?: string[];
  svgs?: string[];
  sizes?: number[];
  speed?: number;
  scale?: number;
  direction?: 'left' | 'right' | 'up' | 'down' | 'zoom-in' | 'zoom-out' | 'pulse' | 'none';
  count?: number;
  dispersion?: number;
  complexity?: number;
  curvature?: number;
  blur?: number;
  seed?: number;
  mode?: string;
  position?: 'bottom' | 'top' | 'opposite-v' | 'opposite-h' | 'radial' | 'left' | 'right' | 'corners' | 'center';
  frequency?: number;
  opacity?: number;
  balance?: number;
  elevation?: number;
  styleMode?: 'solid' | 'outline' | 'dual';
  interpolation?: 'wave' | 'peak' | 'step' | 'blob' | 'scatter' | '3d' | 'sunburst' | 'zigzag';
  contrast?: number;
  strokeWidth?: number;
  colorDirection?: 'down' | 'up' | 'radial' | 'custom';
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export const PATTERN_PRESET_SVGS: Record<string, string> = {
  clouds: `<path d="M17.5 19A5.5 5.5 0 0 0 18 8.02a7.5 7.5 0 0 0-14.93 2.1A5.5 5.5 0 0 0 4.5 21h13a1 1 0 0 0 0-2z" />`,
  stars: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />`,
  heart: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />`,
  bubbles: `<circle cx="12" cy="12" r="8" fill="none" stroke-width="2" /><circle cx="15" cy="9" r="2" />`,
  bolt: `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />`,
  leaf: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 8a7 7 0 0 1-9 10z" />`,
  drop: `<path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-13-7-13S5 10.7 5 15a7 7 0 0 0 7 7z" />`,
  moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />`,
  crown: `<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />`,
  grid: `<path d="M24 0 H0 V24" fill="none" stroke-width="1" />`,
  waves: `<path d="M0 12 Q6 6 12 12 T24 12" fill="none" stroke-width="2" stroke-linecap="round" />`,
  stripes: `<path d="M0 0 L24 24 M-12 12 L12 36 M12 -12 L36 12" fill="none" stroke-width="3" />`,
  dots: `<circle cx="12" cy="12" r="6" />`,
  zigzags: `<path d="M0 12 L6 18 L18 6 L24 12" fill="none" stroke-width="2" stroke-linejoin="round" />`
};

export function generatePatternSVG(options: {
  type: string;
  bgColor: string;
  fgColor: string;
  speed?: number;
  scale?: number;
  direction?: 'left' | 'right' | 'up' | 'down' | 'zoom-in' | 'zoom-out' | 'pulse' | 'none';
  colors?: string[];
  svgs?: string[];
  sizes?: number[];
  // `counts` y `dispersions` los usa el EDITOR al empaquetar -App.tsx- y no
  // estaban en la copy del player. Se toma la interfaz del editor porque es
  // la que describe lo que de verdad viaja: la otra los habria descartado en
  // silencio al comprobar tipos.
  counts?: number[];
  dispersions?: number[];
  count?: number; // cantidad de elementos
  dispersion?: number; // desorden (0 a 1)
  complexity?: number;
  curvature?: number;
  blur?: number;
  seed?: number;
}): string {
  const { type, bgColor, fgColor, scale = 1, colors, svgs, sizes, count, dispersion } = options;
  const baseSize = 160;
  const countVal = count !== undefined && count > 0 ? count : 15;
  const dispersionVal = dispersion !== undefined ? dispersion : 0.5;
  const colorsList = colors && colors.length > 0 ? colors : [fgColor || '#D1D1C7'];
  const activeSvgs = svgs && svgs.length > 0 ? svgs : [type || 'clouds'];

  const MAX_FIGURE = 8000;
  const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // One figure's markup, shared by both layouts below.
  const figureMarkup = (raw: string): string => {
    const item = raw && raw.length <= MAX_FIGURE ? raw : (options.type || "clouds");
    if (PATTERN_PRESET_SVGS[item as keyof typeof PATTERN_PRESET_SVGS]) return PATTERN_PRESET_SVGS[item as keyof typeof PATTERN_PRESET_SVGS];
    if (item.includes("<svg") || item.includes("<path") || item.includes("<circle")) {
      if (item.includes("<svg")) {
        const match = item.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
        return match ? match[1] : item;
      }
      return item;
    }
    if (item.startsWith("M") || item.startsWith("m")) return `<path d="${escapeText(item)}" />`;
    const fontSize = item.length > 2 ? (item.length > 4 ? 8 : 11) : 16;
    return `<text x="12" y="12" font-size="${fontSize}" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" dominant-baseline="central" fill="currentColor">${escapeText(item)}</text>`;
  };

  const { counts, dispersions } = options;
  if ((counts && counts.length > 0) || (dispersions && dispersions.length > 0)) {
    // Per-figure layout (13 Sept): each figure on its own grid, with its own
    // count and dispersion. Only when the lists arrive, so files without them
    // keep the exact tile above (pinned by a fixture test).
    const globalCount = count !== undefined && count > 0 ? count : 15;
    const globalDispersion = dispersion !== undefined ? dispersion : 0.5;
    let content = "";
    activeSvgs.forEach((svgItem, figureIdx) => {
      const itemColor = colorsList[figureIdx] || colorsList[0] || fgColor || "#D1D1C7";
      const itemSize = sizes && sizes[figureIdx] !== undefined ? sizes[figureIdx] : 1.0;
      const itemCount = counts && counts[figureIdx] !== undefined ? counts[figureIdx] : Math.max(1, Math.round(globalCount / activeSvgs.length));
      const itemDispersion = dispersions && dispersions[figureIdx] !== undefined ? dispersions[figureIdx] : globalDispersion;
      const cols = Math.ceil(Math.sqrt(itemCount));
      const rows = Math.ceil(itemCount / cols);
      const gridSize = baseSize / Math.max(1, cols);
      const markup = figureMarkup(svgItem);
      const isStrokeOnly = svgItem === "waves" || svgItem === "grid" || svgItem === "stripes" || svgItem === "zigzags";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= itemCount) break;
          const seedBase = (figureIdx * 100 + idx) * 23.456 + 1.23;
          const posX = Math.max(5, Math.min(baseSize - 5, c * gridSize + gridSize / 2 + (seededRandom(seedBase) - 0.5) * gridSize * itemDispersion * 1.5));
          const posY = Math.max(5, Math.min(baseSize - 5, r * gridSize + gridSize / 2 + (seededRandom(seedBase + 7.4) - 0.5) * gridSize * itemDispersion * 1.5));
          const scaleVar = (0.8 + (seededRandom(seedBase + 13.9) - 0.5) * 0.7 * itemDispersion) * itemSize * scale;
          const rotVar = seededRandom(seedBase + 19.3) * 360 * itemDispersion;
          for (const o of [[0, 0], [-baseSize, 0], [baseSize, 0], [0, -baseSize], [0, baseSize], [-baseSize, -baseSize], [-baseSize, baseSize], [baseSize, -baseSize], [baseSize, baseSize]]) {
            const x = posX + o[0];
            const y = posY + o[1];
            if (x > -30 && x < baseSize + 30 && y > -30 && y < baseSize + 30) {
              content += `<g transform="translate(${x}, ${y}) scale(${scaleVar}) rotate(${rotVar}) translate(-12, -12)" fill="${isStrokeOnly ? "none" : itemColor}" stroke="${isStrokeOnly ? itemColor : "none"}" stroke-width="${isStrokeOnly ? "1.5" : "0"}" stroke-linecap="round" stroke-linejoin="round">${markup}</g>`;
            }
          }
        }
      }
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${baseSize}" height="${baseSize}" viewBox="0 0 ${baseSize} ${baseSize}"><rect width="100%" height="100%" fill="${bgColor}" />${content}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim()).replace(/\(/g, "%28").replace(/\)/g, "%29")}`;
  }

  let patternContent = "";
  const cols = Math.ceil(Math.sqrt(countVal));
  const rows = Math.ceil(countVal / cols);
  const gridSize = baseSize / cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= countVal) break;

      const seedBase = idx * 23.456 + 1.23;
      const baseX = c * gridSize + gridSize / 2;
      const baseY = r * gridSize + gridSize / 2;

      const dispX = (seededRandom(seedBase) - 0.5) * gridSize * dispersionVal * 1.5;
      const dispY = (seededRandom(seedBase + 7.4) - 0.5) * gridSize * dispersionVal * 1.5;
      const posX = Math.max(5, Math.min(baseSize - 5, baseX + dispX));
      const posY = Math.max(5, Math.min(baseSize - 5, baseY + dispY));

      const color = colorsList[idx % colorsList.length];
      const svgIndex = idx % activeSvgs.length;
      const svgItem = activeSvgs[svgIndex] || type || 'clouds';
      const itemSizeMultiplier = (sizes && sizes[svgIndex] !== undefined) ? sizes[svgIndex] : 1.0;

      const scaleVar = (0.8 + (seededRandom(seedBase + 13.9) - 0.5) * 0.7 * dispersionVal) * itemSizeMultiplier * scale;
      const rotVar = seededRandom(seedBase + 19.3) * 360 * dispersionVal;

      const contentSvg = figureMarkup(svgItem);

      const offsets = [
        { dx: 0, dy: 0 },
        { dx: -baseSize, dy: 0 },
        { dx: baseSize, dy: 0 },
        { dx: 0, dy: -baseSize },
        { dx: 0, dy: baseSize },
        { dx: -baseSize, dy: -baseSize },
        { dx: -baseSize, dy: baseSize },
        { dx: baseSize, dy: -baseSize },
        { dx: baseSize, dy: baseSize }
      ];

      const safetyMargin = 30;
      for (const offset of offsets) {
        const x = posX + offset.dx;
        const y = posY + offset.dy;
        if (x > -safetyMargin && x < baseSize + safetyMargin && y > -safetyMargin && y < baseSize + safetyMargin) {
          const isStrokeOnly = svgItem === 'waves' || svgItem === 'grid' || svgItem === 'stripes' || svgItem === 'zigzags';
          const fillAttr = isStrokeOnly ? 'none' : color;
          const strokeAttr = isStrokeOnly ? color : 'none';
          const strokeWidthAttr = isStrokeOnly ? '1.5' : '0';

          patternContent += `
            <g transform="translate(${x}, ${y}) scale(${scaleVar}) rotate(${rotVar}) translate(-12, -12)" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidthAttr}" stroke-linecap="round" stroke-linejoin="round">
              ${contentSvg}
            </g>
          `;
        }
      }
    }
  }

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${baseSize}" height="${baseSize}" viewBox="0 0 ${baseSize} ${baseSize}">
      <rect width="100%" height="100%" fill="${bgColor}" />
      ${patternContent}
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.replace(/\s+/g, ' ').trim())}`;
}

function safeColor(value: string | undefined | null, fallback: string): string {
  const v = value?.trim();
  return v && isSafeCssColor(v) ? v : fallback;
}

export function resolvePatternColors(
  shape: {
    fillPatternColor?: string;
    fillPatternColorRole?: DynamicColorRole;
    fillPatternBgColor?: string;
    fillPatternBgColorRole?: DynamicColorRole;
    backgroundPatternColor?: string;
    backgroundPatternColorRole?: DynamicColorRole;
    backgroundPatternBgColor?: string;
    backgroundPatternBgColorRole?: DynamicColorRole;
  },
  palette?: Record<string, string> | null
): { fgColor: string; bgColor: string } {
  const rawFg = safeColor(shape.backgroundPatternColor || shape.fillPatternColor, "#000000");
  const rawBg = safeColor(shape.backgroundPatternBgColor || shape.fillPatternBgColor, "transparent");
  const fgRole = shape.backgroundPatternColorRole || shape.fillPatternColorRole;
  const bgRole = shape.backgroundPatternBgColorRole || shape.fillPatternBgColorRole;

  // Palette values come from the host page or the file: both go into an SVG.
  const fgColor = fgRole && palette ? safeColor(palette[fgRole], rawFg) : rawFg;
  const bgColor = bgRole && palette ? safeColor(palette[bgRole], rawBg) : rawBg;

  return { fgColor, bgColor };
}

/**
 * Recolors an existing pattern SVG by replacing background and foreground colors
 * while preserving the exact layout, geometry, counts, dispersions and offsets.
 */
export function recolorPatternSvg(
  svg: string,
  rawBg: string,
  resolvedBg: string,
  rawFg: string,
  resolvedFg: string,
  rawColors?: string[],
  resolvedColors?: string[]
): string {
  if (!svg) return "";
  const map = new Map<string, string>();
  const add = (from: string | undefined, to: string | undefined) => {
    if (from && to && !map.has(from.toLowerCase())) map.set(from.toLowerCase(), to);
  };
  add(rawBg, resolvedBg);
  if (rawColors && rawColors.length > 0 && resolvedColors && resolvedColors.length > 0) {
    rawColors.forEach((raw, i) => add(raw, resolvedColors[i] || resolvedFg));
  } else {
    add(rawFg, resolvedFg);
  }
  for (const [from, to] of map) if (from === to.toLowerCase()) map.delete(from);
  if (map.size === 0) return svg;
  // One pass: chained replaces would repaint an inverted pair (bg->fg->bg).
  // Longest first, and no hex digit after, so "#fff" never eats "#ffffff".
  const alternatives = [...map.keys()]
    .sort((x, y) => y.length - x.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return svg.replace(
    new RegExp("(?:" + alternatives.join("|") + ")(?![0-9a-f])", "gi"),
    (m) => map.get(m.toLowerCase()) ?? m
  );
}

type PatternStyle = Record<string, any>;

/** A pattern field from a canvas background (`backgroundPattern*`) or a layer (`fillPattern*`). */
function patternField(style: PatternStyle, name: string): any {
  return style["backgroundPattern" + name] ?? style["fillPattern" + name];
}

/** Whether the pattern draws its shapes in more than one colour. */
export function isMultiColorPattern(style: PatternStyle): boolean {
  return (patternField(style, "Colors")?.length ?? 0) > 1;
}

/**
 * The tile of a pattern as a data URI, painted with `bg` and `fg`. `tileSvg` is
 * the editor's baked tile when there is one; otherwise the tile is generated.
 * With bg and `rest` transparent and fg black it is the alpha mask of the
 * first colour, which the player tints in CSS.
 */
export function patternTileUri(style: PatternStyle, tileSvg: string, bg: string, fg: string, rest?: string): string {
  const rawColors: string[] | undefined = patternField(style, "Colors");
  // Only the first colour has a role; `rest` repaints the fixed others (e.g. transparent).
  const colors = rawColors?.length ? [fg, ...rawColors.slice(1).map((c) => rest ?? c)] : [fg];
  if (tileSvg) {
    const { fgColor: rawFg, bgColor: rawBg } = resolvePatternColors(style, null);
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(recolorPatternSvg(tileSvg, rawBg, bg, rawFg, fg, rawColors, colors))
    );
  }
  const type = patternField(style, "Type");
  const svgs = patternField(style, "Svgs");
  if (!type && !svgs) return "";
  return generatePatternSVG({
    type: type || "clouds",
    bgColor: bg,
    fgColor: fg,
    scale: parseFloat(patternField(style, "Scale")) || 1,
    colors,
    svgs,
    sizes: patternField(style, "Sizes"),
    counts: patternField(style, "Counts"),
    dispersions: patternField(style, "Dispersions"),
    count: style.backgroundPatternCount,
    dispersion: style.backgroundPatternDispersion,
  });
}
