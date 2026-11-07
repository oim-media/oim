/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The curved-text path is imported from `@oim-media/core`: it was written here
 * and again in the editor, and the two copies had diverged (the arc came out 80%
 * more curved when published than when edited, and the wave 29% flatter).
 * The editor's geometry was kept; the reason is in the core's file.
 */
import { calculateTextCurvePath, artisticTextLines } from '../../../core/src/artisticTextCurve.js';
// The extrusion comes from the core, shared with the editor. The player's own
// copy lightened the colour while the editor darkened it.
import { calculate3DExtrusionLayers, type ExtrusionStep } from '../../../core/src/artisticTextExtrusion.js';
import { resolveLineHeight } from '../../../core/src/typography.js';
export { calculateTextCurvePath };

export interface ArtisticTextRenderModel {
  text: string;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  letterSpacing: number;
  lineHeight: number;
  fillColor: string;
  curvePathD: string;
  isCurved: boolean;
  extrusionLayers: ExtrusionStep[];
  outerStrokeColor?: string;
  outerStrokeWidth: number;
  innerStrokeColor?: string;
  innerStrokeWidth: number;
  textGradientType?: "none" | "linear" | "metallic-chrome" | "sunset-gold" | "neon-glow";
}


/**
 * Builds the full vector rendering model from the viewer's slot.
 */
export function buildArtisticTextModelFromSlot(
  slot: any,
  lang: string = "en",
  canvasWidth: number = 800
): ArtisticTextRenderModel {
  // Sizes are canvas px: a number, "Npx", or "Ncqw" of the canvas width (the exporter's form).
  const px = (v: unknown): number | undefined => {
    if (typeof v === "number") return v > 0 ? v : undefined;
    if (typeof v !== "string") return undefined;
    const n = parseFloat(v);
    if (!(n > 0)) return undefined;
    return v.includes("cqw") ? (n / 100) * canvasWidth : n;
  };
  // Short aliases (st, c) retired in 1.12.0: one name per concept.
  const style = slot.style || {};
  const contentObj = slot.content || {};
  const text =
    (typeof contentObj === "object" ? (contentObj[lang] || contentObj.es || contentObj.en || Object.values(contentObj)[0]) : contentObj) ||
    "CARTEL";

  const width = slot.width_px || slot.w || px(style.width) || 400;
  const height = slot.height_px || slot.h || px(style.height) || 120;
  const fontFamily = style.fontFamily || "Bangers";
  const fontSize = (typeof slot.font_size_px === "number" && slot.font_size_px > 0 ? slot.font_size_px : px(style.fontSize)) || 48;
  const bold = style.fontWeight === "bold" || Number(style.fontWeight) >= 700;
  const letterSpacing = typeof style.letterSpacing === "number" ? style.letterSpacing : parseFloat(style.letterSpacing) || 0;
  // Same rule as the editor (default 1.25, clamped). The player used to fall
  // back to 1.2, which only shows once text has more than one line.
  const lineHeight = resolveLineHeight(style);

  const curveAmount = typeof style.curveAmount === "number" ? style.curveAmount : 0;
  const curveType = style.curveType || "arc";
  const curvePathD = calculateTextCurvePath(width, height, curveAmount, curveType);
  const isCurved = curveAmount !== 0;

  const extrusionDepth = typeof style.extrusionDepth === "number" ? style.extrusionDepth : 0;
  const extrusionAngle = typeof style.extrusionAngle === "number" ? style.extrusionAngle : 45;
  const extrusionColor = style.extrusionColor || "#111827";
  const extrusionShading = style.extrusionShading !== false;

  const extrusionLayers = calculate3DExtrusionLayers(
    extrusionDepth,
    extrusionAngle,
    extrusionColor,
    extrusionShading
  );

  return {
    text: String(text),
    width,
    height,
    fontFamily,
    fontSize,
    bold,
    letterSpacing,
    lineHeight,
    fillColor: style.fillColor || "#FBBF24",
    curvePathD,
    isCurved,
    extrusionLayers,
    outerStrokeColor: style.outerStrokeColor,
    outerStrokeWidth: typeof style.outerStrokeWidth === "number" ? style.outerStrokeWidth : 0,
    innerStrokeColor: style.innerStrokeColor,
    innerStrokeWidth: typeof style.innerStrokeWidth === "number" ? style.innerStrokeWidth : 0,
    textGradientType: style.textGradientType || "none",
  };
}

/**
 * Generates the full vector SVG markup for an artistic-text shape.
 */
export function generateArtisticTextSvgString(
  model: ArtisticTextRenderModel,
  id: string = "artistic-text"
): string {
  const pathId = `curve-path-${id}`;
  const gradId = `artistic-grad-${id}`;

  let frontFill = model.fillColor;
  let gradientSvg = "";

  if (model.textGradientType === "sunset-gold") {
    frontFill = `url(#${gradId})`;
    gradientSvg = `
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FDE047" />
        <stop offset="50%" stop-color="#F97316" />
        <stop offset="100%" stop-color="#BE185D" />
      </linearGradient>`;
  } else if (model.textGradientType === "metallic-chrome") {
    frontFill = `url(#${gradId})`;
    gradientSvg = `
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="35%" stop-color="#E2E8F0" />
        <stop offset="50%" stop-color="#64748B" />
        <stop offset="51%" stop-color="#0F172A" />
        <stop offset="75%" stop-color="#94A3B8" />
        <stop offset="100%" stop-color="#FFFFFF" />
      </linearGradient>`;
  } else if (model.textGradientType === "neon-glow") {
    frontFill = `url(#${gradId})`;
    gradientSvg = `
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#67E8F9" />
        <stop offset="100%" stop-color="#A5F3FC" />
      </linearGradient>`;
  }

  const fontFamily = `${model.fontFamily}, sans-serif`;
  const fontWeight = model.bold ? "bold" : "normal";
  const letterSpacing = model.letterSpacing ? `letter-spacing="${model.letterSpacing}px"` : "";

  const escapeText = (t: string) =>
    t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  // One group per line: an SVG <text> does not break lines, it paints "\n"
  // as a space. Each line keeps its full layer stack (extrusion, outer
  // stroke, face) and is shifted from the centre by artisticTextLines, the
  // same layout the editor uses.
  const lineSvg = (escapedText: string): string => {
  let contentSvg = "";
  if (model.isCurved) {
    const extSvg = model.extrusionLayers
      .map(
        (l) =>
          `<text font-family="${fontFamily}" font-size="${model.fontSize}" font-weight="${fontWeight}" ${letterSpacing} fill="${l.color}" stroke="${l.color}" stroke-width="${model.outerStrokeWidth > 0 ? model.outerStrokeWidth : 1}" stroke-linejoin="round" transform="translate(${l.dx}, ${l.dy})" opacity="${l.opacity}"><textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapedText}</textPath></text>`
      )
      .join("\n");

    const outerStrokeSvg =
      model.outerStrokeWidth > 0 && model.outerStrokeColor
        ? `<text font-family="${fontFamily}" font-size="${model.fontSize}" font-weight="${fontWeight}" ${letterSpacing} fill="none" stroke="${model.outerStrokeColor}" stroke-width="${model.outerStrokeWidth * 2}" stroke-linejoin="round"><textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapedText}</textPath></text>`
        : "";

    const frontSvg = `<text font-family="${fontFamily}" font-size="${model.fontSize}" font-weight="${fontWeight}" ${letterSpacing} fill="${frontFill}" stroke="${model.innerStrokeWidth > 0 ? (model.innerStrokeColor || "#FFFFFF") : "none"}" stroke-width="${model.innerStrokeWidth > 0 ? model.innerStrokeWidth : 0}" paint-order="stroke fill" stroke-linejoin="round"><textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapedText}</textPath></text>`;

    contentSvg = `${extSvg}\n${outerStrokeSvg}\n${frontSvg}`;
  } else {
    const extSvg = model.extrusionLayers
      .map(
        (l) =>
          `<text x="50%" y="50%" font-family="${fontFamily}" font-size="${model.fontSize}" font-weight="${fontWeight}" ${letterSpacing} text-anchor="middle" dominant-baseline="central" fill="${l.color}" stroke="${l.color}" stroke-width="${model.outerStrokeWidth > 0 ? model.outerStrokeWidth : 1}" stroke-linejoin="round" transform="translate(${l.dx}, ${l.dy})" opacity="${l.opacity}">${escapedText}</text>`
      )
      .join("\n");

    const outerStrokeSvg =
      model.outerStrokeWidth > 0 && model.outerStrokeColor
        ? `<text x="50%" y="50%" font-family="${fontFamily}" font-size="${model.fontSize}" font-weight="${fontWeight}" ${letterSpacing} text-anchor="middle" dominant-baseline="central" fill="none" stroke="${model.outerStrokeColor}" stroke-width="${model.outerStrokeWidth * 2}" stroke-linejoin="round">${escapedText}</text>`
        : "";

    const frontSvg = `<text x="50%" y="50%" font-family="${fontFamily}" font-size="${model.fontSize}" font-weight="${fontWeight}" ${letterSpacing} text-anchor="middle" dominant-baseline="central" fill="${frontFill}" stroke="${model.innerStrokeWidth > 0 ? (model.innerStrokeColor || "#FFFFFF") : "none"}" stroke-width="${model.innerStrokeWidth > 0 ? model.innerStrokeWidth : 0}" paint-order="stroke fill" stroke-linejoin="round">${escapedText}</text>`;

    contentSvg = `${extSvg}\n${outerStrokeSvg}\n${frontSvg}`;
  }
  return contentSvg;
  };

  const contentSvg = artisticTextLines(model.text || "", model.fontSize, model.lineHeight)
    .map((line) => `<g transform="translate(0, ${line.offset})">${lineSvg(escapeText(line.text))}</g>`)
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${model.width} ${model.height}" preserveAspectRatio="xMidYMid meet" overflow="visible" style="pointer-events:none;">
  <defs>
    ${gradientSvg}
    ${model.isCurved ? `<path id="${pathId}" d="${model.curvePathD}" fill="none" />` : ""}
  </defs>
  <g>
    ${contentSvg}
  </g>
</svg>`;
}
