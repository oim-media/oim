/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mediaFilterCss } from "../../../core/src/media-filters.js";

// Mask clip presets, in a normalized "0 0 100 100" viewBox.
// Mirrors the editor's MASK_SHAPE_PATHS 1:1 so a mask looks identical in the
// editor and the player. There the polygons are DERIVED from the shared shape
// table; here they are literals, pinned by maskShapes.test.ts.
//
// triangle, line, arrow and diamond were missing: the lookup below falls back
// to `circle` when it does not know a name, and it does so SILENTLY, so a
// triangular mask looked like a triangle in the editor and like a circle in the
// player.
//
// star and hexagon also did not match -they came out as 100/0 here and as 95/5
// on the canvas-, so the same shape had two silhouettes depending on where you
// looked. They are aligned with the canvas values, which are the ones the user
// has in front of them while designing.
//
// If a shape is changed, both tables must be changed.
export const MASK_SHAPE_PATHS: Record<string, string> = {
  circle: "M50 0 A50 50 0 1 1 49.99 0 Z",
  rectangle: "M0 0 H100 V100 H0 Z",
  heart: "M50 88 C10 60 -5 30 15 12 C30 -2 50 5 50 25 C50 5 70 -2 85 12 C105 30 90 60 50 88 Z",
  blob: "M40 4 C70 -4 100 20 96 48 C104 78 72 100 44 96 C12 100 -8 72 4 44 C0 16 16 8 40 4 Z",
  triangle: "M50 5 L95 90 L5 90 Z",
  star: "M50 2 L62 38 L100 38 L69 59 L80 95 L50 73 L20 95 L31 59 L0 38 L38 38 Z",
  line: "M5 45 L95 45 L95 55 L5 55 Z",
  arrow: "M5 40 L60 40 L60 20 L95 50 L60 80 L60 60 L5 60 Z",
  diamond: "M50 5 L95 50 L50 95 L5 50 Z",
  hexagon: "M25 5 L75 5 L95 50 L75 95 L25 95 L5 50 Z"
};

export interface Slot {
  id: string;
  type: string;
  style?: Record<string, any>;
}

export function getMaskClipPathId(slot: Slot): string {
  return `mask-clip-${slot.id}`;
}

/**
 * The cut-out silhouette, without the inversion rectangle.
 *
 * `maskShape`/`maskSvgPath` are the fields of the dedicated mask; `geoShape`
 * and `svgPath` are those of the classic mask over a shape. Both are accepted
 * because the two types share this function.
 */
export function getMaskSilhouettePath(slot: Slot): string {
  const style = slot.style || {};
  const shapeName = style.maskShape || style.geoShape;
  const svgCustom = style.maskSvgPath || style.svgPath;

  if (svgCustom && (!shapeName || shapeName === "custom")) {
    return svgCustom;
  }
  const preset = shapeName && MASK_SHAPE_PATHS[shapeName];
  return preset || MASK_SHAPE_PATHS.circle;
}

export function getMaskPathData(slot: Slot): string {
  const style = slot.style || {};
  const path = getMaskSilhouettePath(slot);
  // The "window" mode paints the frame and leaves the silhouette hollow, so it
  // needs the same full-coverage rectangle as the inversion.
  return (style.maskInvert || style.maskMode === "window")
    ? `M0 0H100V100H0Z ${path}`
    : path;
}

/**
 * The mask frame in window mode, in CANVAS COORDINATES.
 *
 * `getMaskPathData` returns the frame in a "0 0 100 100" viewBox that is
 * stretched over the box of the shape itself, so the area it hides is limited
 * by the mask's size: to cover the canvas, the mask had to be sized EXACTLY like
 * the canvas, and any difference left a visible strip. Editors treat a mask as
 * a relation, not as a painted rectangle: the silhouette decides what is seen,
 * and the occlusion extends without limit, never clipped to the mask's bounding
 * box.
 *
 * Here the frame is always the entire canvas and only the hole follows the
 * shape's box, with `fill-rule="evenodd"`. It is the same coordinate space that
 * `getMaskClipPathD` already used for the cut-out mode (`userSpaceOnUse`), so
 * the two modes now share one model.
 */
export function getWindowMaskCanvasD(
  slot: Slot,
  artboard: { width: number; height: number }
): string {
  const { width: W, height: H } = artboard;
  const s = slot as any;

  const pos = Array.isArray(s.position) ? s.position : [0, 0];
  const x = typeof s.x === "number" ? s.x : (Number(pos[0]) / 100) * W;
  const y = typeof s.y === "number" ? s.y : (Number(pos[1]) / 100) * H;
  const w = typeof s.width === "number" ? s.width : Number(s.width_px) || 0;
  const h = typeof s.height === "number" ? s.height : Number(s.height_px) || 0;

  // Frame scope: 'canvas' covers the entire canvas (no strips even if the box
  // is smaller); 'container' limits it to the shape's box.
  const coverage = (s.maskCoverage || (s.style && s.style.maskCoverage)) === "container"
    ? "container"
    : "canvas";
  const frameBox = coverage === "container"
    ? `M${x} ${y}H${x + w}V${y + h}H${x}Z`
    : `M0 0H${W}V${H}H0Z`;

  const cuts = s.cuts || (s.style && s.style.cuts);
  if (cuts && Array.isArray(cuts) && cuts.length > 0) {
    const silhouettes = cuts.map((cut: any) => {
      const cutPath = cut.svgPath || MASK_SHAPE_PATHS[cut.shape] || MASK_SHAPE_PATHS.circle;
      return scalePath(cutPath, x + (cut.x || 0), y + (cut.y || 0), cut.width || 0, cut.height || 0);
    }).join(" ");
    return `${frameBox} ${silhouettes}`;
  }

  return `${frameBox} ${scalePath(getMaskSilhouettePath(slot), x, y, w, h)}`;
}

/**
 * Only the silhouette, in canvas coordinates. It is used by the cut-out outline,
 * which must trace the hole but not the frame.
 */
export function getMaskSilhouetteCanvasD(
  slot: Slot,
  artboard: { width: number; height: number }
): string {
  const s = slot as any;
  const pos = Array.isArray(s.position) ? s.position : [0, 0];
  const x = typeof s.x === "number" ? s.x : (Number(pos[0]) / 100) * artboard.width;
  const y = typeof s.y === "number" ? s.y : (Number(pos[1]) / 100) * artboard.height;
  const w = typeof s.width === "number" ? s.width : Number(s.width_px) || 0;
  const h = typeof s.height === "number" ? s.height : Number(s.height_px) || 0;
  return scalePath(getMaskSilhouettePath(slot), x, y, w, h);
}

/**
 * CSS of a slot's filter (backdrop `filter` layer). The preset table and the
 * composition live in @oim-media/core, shared with image layers and photo frames.
 */
export function getFilterCss(target: Slot | string | undefined): string | undefined {
  if (!target) return undefined;

  if (typeof target === "string") return mediaFilterCss({ filterPreset: target });

  const style: Record<string, any> = target.style || {};
  return mediaFilterCss({ ...style, filterPreset: style.filterPreset || style.fp });
}

export const DUOTONE_COLORS = { shadows: "#1e1b4b", lights: "#fbbf24" };

export function getDuotoneFilterId(slot: Slot): string {
  return `duotone-filter-${slot.id}`;
}

export function getMaskFeatherId(slot: Slot): string {
  return `mask-feather-${slot.id}`;
}

export type CompositionNode =
  | { kind: "shape"; shape: Slot; clipPath?: string; maskStyle?: string }
  | { kind: "filterGroup"; shape: Slot; children: CompositionNode[]; clipPath?: string; maskStyle?: string };

function scalePath(d: string, x: number, y: number, w: number, h: number): string {
  const normalized = d.replace(/,/g, " ");
  const tokens = normalized.match(/[a-df-z]|-?\d+(?:\.\d+)?/gi) || [];
  let curX = 0;
  let curY = 0;
  let res = "";
  let i = 0;
  let mode = "";

  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-df-z]$/i.test(t)) {
      mode = t;
      i++;
      if (mode === "Z" || mode === "z") {
        res += "Z ";
      }
    } else {
      if (mode === "M" || mode === "m" || mode === "L" || mode === "l") {
        curX = parseFloat(t);
        curY = parseFloat(tokens[i + 1]);
        i += 2;
        const px = x + (curX / 100) * w;
        const py = y + (curY / 100) * h;
        res += `${mode === "m" ? "M" : mode === "l" ? "L" : mode} ${parseFloat(px.toFixed(3))} ${parseFloat(py.toFixed(3))} `;
      } else if (mode === "H" || mode === "h") {
        curX = parseFloat(t);
        i++;
        const px = x + (curX / 100) * w;
        const py = y + (curY / 100) * h;
        res += `L ${parseFloat(px.toFixed(3))} ${parseFloat(py.toFixed(3))} `;
      } else if (mode === "V" || mode === "v") {
        curY = parseFloat(t);
        i++;
        const px = x + (curX / 100) * w;
        const py = y + (curY / 100) * h;
        res += `L ${parseFloat(px.toFixed(3))} ${parseFloat(py.toFixed(3))} `;
      } else if (mode === "C" || mode === "c") {
        const x1 = parseFloat(tokens[i]);
        const y1 = parseFloat(tokens[i + 1]);
        const x2 = parseFloat(tokens[i + 2]);
        const y2 = parseFloat(tokens[i + 3]);
        const ex = parseFloat(tokens[i + 4]);
        const ey = parseFloat(tokens[i + 5]);
        i += 6;
        curX = ex;
        curY = ey;
        const px1 = x + (x1 / 100) * w;
        const py1 = y + (y1 / 100) * h;
        const px2 = x + (x2 / 100) * w;
        const py2 = y + (y2 / 100) * h;
        const pex = x + (ex / 100) * w;
        const pey = y + (ey / 100) * h;
        res += `C ${parseFloat(px1.toFixed(3))} ${parseFloat(py1.toFixed(3))} ${parseFloat(px2.toFixed(3))} ${parseFloat(py2.toFixed(3))} ${parseFloat(pex.toFixed(3))} ${parseFloat(pey.toFixed(3))} `;
      } else if (mode === "A" || mode === "a") {
        const rx = parseFloat(tokens[i]);
        const ry = parseFloat(tokens[i + 1]);
        const rot = parseFloat(tokens[i + 2]);
        const la = parseFloat(tokens[i + 3]);
        const sw = parseFloat(tokens[i + 4]);
        const ex = parseFloat(tokens[i + 5]);
        const ey = parseFloat(tokens[i + 6]);
        i += 7;
        curX = ex;
        curY = ey;
        const prx = (rx / 100) * w;
        const pry = (ry / 100) * h;
        const pex = x + (ex / 100) * w;
        const pey = y + (ey / 100) * h;
        res += `A ${parseFloat(prx.toFixed(3))} ${parseFloat(pry.toFixed(3))} ${rot} ${la} ${sw} ${parseFloat(pex.toFixed(3))} ${parseFloat(pey.toFixed(3))} `;
      } else {
        res += `${t} `;
        i++;
      }
    }
  }

  return res.trim();
}

export function getMaskClipPathD(
  slot: Slot,
  artboard: { width: number; height: number }
): string {
  const { width: W, height: H } = artboard;
  const s = slot as any;

  // A slot's geometry in the .oim does NOT live in `style`: the position travels
  // in `position: [xPercent, yPercent]` and the size in `width_px`/`height_px`.
  // `style.width` exists but is a string in `cqw` ("60.0cqw"), so using it here
  // produced text concatenations and NaN instead of coordinates.
  const pos = Array.isArray(s.position) ? s.position : [0, 0];
  const x = typeof s.x === "number" ? s.x : (Number(pos[0]) / 100) * W;
  const y = typeof s.y === "number" ? s.y : (Number(pos[1]) / 100) * H;
  const w = typeof s.width === "number" ? s.width : Number(s.width_px) || 0;
  const h = typeof s.height === "number" ? s.height : Number(s.height_px) || 0;

  const canvas = `M0 0H${W}V${H}H0Z`;
  const box = `M${x} ${y}H${x + w}V${y + h}H${x}Z`;

  const cuts = s.cuts || (s.style && s.style.cuts);
  if (cuts && Array.isArray(cuts) && cuts.length > 0) {
    const silhouettes = cuts.map((cut: any) => {
      const cutPath = cut.svgPath || MASK_SHAPE_PATHS[cut.shape] || MASK_SHAPE_PATHS.circle;
      const cx = x + (cut.x || 0);
      const cy = y + (cut.y || 0);
      return scalePath(cutPath, cx, cy, cut.width || 0, cut.height || 0);
    }).join(" ");
    return `${canvas} ${box} ${silhouettes}`;
  }

  const silhouette = scalePath(getMaskSilhouettePath(slot), x, y, w, h);
  return `${canvas} ${box} ${silhouette}`;
}

/**
 * Walks `slots` once and produces a tree of render nodes.
 * - A layer with `type === "mask"` in `cutout` mode clips all the layers placed
 *   behind it in the Z hierarchy (positional scope of the filter).
 * - A dedicated mask (`type === "mask"`) in `window` mode is a frame that is
 *   visible on its own: it generates its own `shape` node.
 * - A layer with `type === 'filter'` is rendered as a standard positional layer
 *   ('shape') with `backdrop-filter`.
 */
export function computeLayerComposition(slots: Slot[]): CompositionNode[] {
  let acc: CompositionNode[] = [];

  for (const slot of slots) {
    if (slot.type === "mask") {
      const style = slot.style || {};
      if (style.maskMode !== "cutout") {
        acc = [...acc, { kind: "shape", shape: slot }];
        continue;
      }

      const withCutout = !!(style.maskFeather && style.maskFeather > 0);
      const reference = withCutout
        ? { maskStyle: `url(#${getMaskFeatherId(slot)})` }
        : { clipPath: `url(#${getMaskClipPathId(slot)})` };

      acc = acc.map(node => {
        if (node.clipPath || node.maskStyle) {
          return { kind: "filterGroup", shape: slot, children: [node], ...reference } as CompositionNode;
        }
        return { ...node, ...reference };
      });
      continue;
    }

    acc = [...acc, { kind: "shape", shape: slot }];
  }

  return acc;
}
