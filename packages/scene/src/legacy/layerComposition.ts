/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mediaFilterCss } from "../../../core/src/media-filters.js";
import { maskOutlinePath, type MaskBox } from "../../../core/src/mask-outline.js";
import { filterClipPath } from "../../../core/src/filter-shape.js";

// Mask silhouettes are drawn by core's maskOutlinePath, the same catalogue the
// editor uses. An unknown shape has no silhouette: it is never drawn as a circle.

const UNIT_BOX: MaskBox = { x: 0, y: 0, width: 100, height: 100 };

export interface Slot {
  id: string;
  type: string;
  style?: Record<string, any>;
}

export function getMaskClipPathId(slot: Slot): string {
  return `mask-clip-${slot.id}`;
}

/**
 * A slot's box in canvas units. The geometry of a .oim slot does NOT live in
 * `style`: the position travels in `position` (percent) and the size in
 * `width_px`/`height_px`; `x`, `y`, `width` and `height` win when present.
 */
export function getMaskBox(slot: Slot, artboard: { width: number; height: number }): MaskBox {
  const s = slot as any;
  const pos = Array.isArray(s.position) ? s.position : [0, 0];
  return {
    x: typeof s.x === "number" ? s.x : (Number(pos[0]) / 100) * artboard.width,
    y: typeof s.y === "number" ? s.y : (Number(pos[1]) / 100) * artboard.height,
    width: typeof s.width === "number" ? s.width : Number(s.width_px) || 0,
    height: typeof s.height === "number" ? s.height : Number(s.height_px) || 0,
  };
}

/** A box as a rectangle path: the silhouette of a rectangle mask, and the fallback of one that cannot be drawn. */
function boxRectangle(box: MaskBox): string {
  return `M${box.x} ${box.y}H${box.x + box.width}V${box.y + box.height}H${box.x}Z`;
}

/** The catalogue draws no rectangle (it is the box): a mask rectangle is the box itself. */
function namedOutline(name: string, box: MaskBox): string | null {
  if (name === "rect" || name === "rectangle") return boxRectangle(box);
  return maskOutlinePath({ geoShape: name }, box);
}

/**
 * The mask's own outline in `box`. A custom path wins only when no catalogue
 * shape is named; with neither, the circle. Null when nothing can be drawn.
 *
 * `maskShape`/`maskSvgPath` are the fields of the dedicated mask; `geoShape` and
 * `svgPath` are those of the classic mask over a shape. Both are accepted.
 */
function outlineIn(slot: Slot, box: MaskBox): string | null {
  const style = slot.style || {};
  const name: string | undefined = style.maskShape || style.geoShape;
  const svgPath: string | undefined = style.maskSvgPath || style.svgPath;
  if (svgPath && (!name || name === "custom")) return maskOutlinePath({ svgPath }, box);
  return namedOutline(name || "circle", box);
}

function cutBoxOf(cut: any, box: MaskBox): MaskBox {
  return {
    x: box.x + (cut.x || 0),
    y: box.y + (cut.y || 0),
    width: cut.width || 0,
    height: cut.height || 0,
  };
}

/** One cut's outline: its own path, else its catalogue shape (a circle when it names none). Null when it cannot be drawn. */
function cutOutline(cut: any, box: MaskBox): string | null {
  const cutBox = cutBoxOf(cut, box);
  return cut.svgPath
    ? maskOutlinePath({ svgPath: cut.svgPath }, cutBox)
    : namedOutline(cut.shape || "circle", cutBox);
}

function cutsOf(slot: Slot): any[] {
  const s = slot as any;
  const cuts = s.cuts || (s.style && s.style.cuts);
  return Array.isArray(cuts) ? cuts : [];
}

/**
 * Every silhouette the mask cuts (its cuts, or its one outline), in canvas units.
 * An outline that cannot be drawn falls back to its box (or the cut's box), so the
 * mask never disappears and never turns into a circle.
 */
function silhouettesIn(slot: Slot, box: MaskBox): string {
  const cuts = cutsOf(slot);
  if (cuts.length > 0) {
    return cuts.map((cut) => cutOutline(cut, box) ?? boxRectangle(cutBoxOf(cut, box))).join(" ");
  }
  return outlineIn(slot, box) ?? boxRectangle(box);
}

/**
 * True when every outline of the mask can be drawn. False means one of them falls
 * back to its box, which is when the player warns once.
 */
export function maskOutlineResolves(slot: Slot): boolean {
  const cuts = cutsOf(slot);
  if (cuts.length > 0) return cuts.every((cut) => cutOutline(cut, UNIT_BOX) !== null);
  return outlineIn(slot, UNIT_BOX) !== null;
}

/**
 * The cut-out silhouette in the mask's own "0 0 100 100" space, without the
 * inversion rectangle. It is the box when the outline cannot be drawn.
 */
export function getMaskSilhouettePath(slot: Slot): string {
  return outlineIn(slot, UNIT_BOX) ?? boxRectangle(UNIT_BOX);
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
 * The mask frame in window mode, in CANVAS COORDINATES, with its hole.
 *
 * The frame is the whole canvas by default (`maskCoverage: "canvas"`), so a
 * small mask leaves no strip; `"container"` limits it to the mask's box. Only
 * the hole follows the silhouette, with `fill-rule="evenodd"`. An outline that
 * cannot be drawn leaves a hole the size of the mask's box.
 */
export function getWindowMaskCanvasD(
  slot: Slot,
  artboard: { width: number; height: number }
): string {
  const { width: W, height: H } = artboard;
  const s = slot as any;
  const box = getMaskBox(slot, artboard);

  const coverage = (s.maskCoverage || (s.style && s.style.maskCoverage)) === "container"
    ? "container"
    : "canvas";
  const frameBox = coverage === "container"
    ? boxRectangle(box)
    : `M0 0H${W}V${H}H0Z`;

  return `${frameBox} ${silhouettesIn(slot, box)}`;
}

/** Only the silhouette, in canvas coordinates. The cut-out outline traces the hole, not the frame. */
export function getMaskSilhouetteCanvasD(
  slot: Slot,
  artboard: { width: number; height: number }
): string {
  const box = getMaskBox(slot, artboard);
  return outlineIn(slot, box) ?? boxRectangle(box);
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

/**
 * The clip of a filter shaped like a catalogue figure, over the filter's own box.
 * A rectangle keeps its border radius (no clip) and an open stroke cannot clip.
 */
export function getFilterClipStyle(
  geoShape: string | undefined,
  box: { width: number; height: number }
): { clipPath?: string } {
  if (!geoShape || geoShape === "rectangle" || geoShape === "rect") return {};
  const d = filterClipPath({ geoShape }, { x: 0, y: 0, width: box.width, height: box.height });
  return d === null ? {} : { clipPath: `path("${d}")` };
}

export { DUOTONE_COLORS } from "../blocks/duotone.js";

export function getDuotoneFilterId(slot: Slot): string {
  return `duotone-filter-${slot.id}`;
}

export function getMaskFeatherId(slot: Slot): string {
  return `mask-feather-${slot.id}`;
}

export type CompositionNode =
  | { kind: "shape"; shape: Slot; clipPath?: string; maskStyle?: string }
  | { kind: "filterGroup"; shape: Slot; children: CompositionNode[]; clipPath?: string; maskStyle?: string };

/**
 * The clip of a cut-out mask, in canvas units: the canvas, the mask box and the
 * silhouette, under evenodd. Outside the box the image shows; inside, only the
 * silhouette. An outline that cannot be drawn clips to the box.
 */
export function getMaskClipPathD(
  slot: Slot,
  artboard: { width: number; height: number }
): string {
  const { width: W, height: H } = artboard;
  const box = getMaskBox(slot, artboard);
  const canvas = `M0 0H${W}V${H}H0Z`;
  return `${canvas} ${boxRectangle(box)} ${silhouettesIn(slot, box)}`;
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
