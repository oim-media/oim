/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DYNAMIC_COLOR_ROLES, filterClipPath, GRAIN_LAYER_TYPES, resolvePalette } from "@oim-media/core";
import { geometryOutline, paintColors, palettesOf, type Box, type Layer, type OimDocument, type Outline, type PaintColors } from "@oim-media/core/v2";
import { applyBox, type Frame } from "./box.js";
import { applyCorners } from "./blocks/corners.js";
import { effectsToStyle } from "./blocks/effects.js";
import { applyFills, pictureNode } from "./blocks/fills.js";
import { applyGeometry } from "./blocks/geometry.js";
import { defineGrain } from "./blocks/grain.js";
import { readEmbeddedFonts, registerEmbeddedFonts } from "./blocks/fonts.js";
import { pictureOf } from "./blocks/image.js";
import { applyStrokes } from "./blocks/strokes.js";
import { applyCompositing } from "./blocks/compositing.js";
import { applyText } from "./blocks/text.js";
import { unsupportedUse } from "./coverage.js";

export type SceneOptions = {
  language?: string;
  palette?: string;
  /** Until 2.0 files carry a poster, the 1.x base image the layers compose on. */
  base?: { src: string } | null;
  paused?: boolean;
};

export type Scene = {
  update(id: string, changes: Partial<Layer>): void;
  setTransform(id: string, box: Box): void;
  elementOf(id: string): HTMLElement | null;
  setMode(mode: { language?: string; palette?: string }): void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  destroy(): void;
};

/** The frame is the parent's, so a child can be placed again from canvas units. */
type Entry = { el: HTMLElement; layer: Layer; frame: Frame };

const notYet = (name: string) => () => {
  throw new Error(`scene.${name} is not implemented yet`);
};

/** The file's language that the reader's own matches (exactly, then by its main tag), else the file's first. */
function languageOf(languages: string[], reader: string | undefined): string {
  const main = (tag: string) => tag.toLowerCase().split("-")[0];
  return languages.find((l) => reader !== undefined && l.toLowerCase() === reader.toLowerCase())
    ?? languages.find((l) => reader !== undefined && main(l) === main(reader))
    ?? languages[0];
}

export function mount(container: HTMLElement, document: OimDocument, _options: SceneOptions = {}): Scene {
  const { width, height } = document.canvas;
  // The canvas keeps its ratio inside its container and sits in the middle of it, as the player letterboxes it.
  const letterbox = container.ownerDocument.createElement("div");
  Object.assign(letterbox.style, { position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" });
  const root = container.ownerDocument.createElement("div");
  root.className = "oim-scene";
  Object.assign(root.style, { position: "relative", width: "100%", maxHeight: "100%", aspectRatio: `${width} / ${height}`, containerType: "inline-size", isolation: "isolate" });
  letterbox.appendChild(root);

  const entries = new Map<string, Entry>();
  const canvas: Frame = { x: 0, y: 0, width, height };
  // With both light and dark palettes, the reader's colour scheme decides, as the player does.
  const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const { colors, active } = sceneColors(document.variables, _options.palette, prefersDark);
  // The file's own fonts, under their own names; a face that fails to load falls back to the family.
  const embedded = readEmbeddedFonts(document);
  void registerEmbeddedFonts(embedded);
  const fonts = new Map(embedded.map((e) => [e.family, e.name]));
  // The active palette's roles become custom properties, so a colour bound to a role is a var() and a mode change needs no repaint.
  for (const role of DYNAMIC_COLOR_ROLES) {
    const value = active?.colors[role];
    if (value) root.style.setProperty(`--oim-palette-${role}`, value);
  }
  // A block scene does not paint yet is ignored, and said once per block type, not per layer.
  for (const block of unsupportedUse(document)) console.warn(`[oim scene] "${block}" is not painted yet; it is ignored`);

  applyFills(root, document.canvas, { colors, isText: false });
  const lang = languageOf(document.languages, _options.language ?? (typeof navigator === "undefined" ? undefined : navigator.language));

  /** The effects the scene paints (blur, shadow, glow, backdrop); grain, texture and duotone wait for their own painter (see coverage). */
  const applyEffects = (el: HTMLElement, layer: Layer) => {
    const style = effectsToStyle(layer.effects, {
      isText: layer.type === "text",
      grainable: (GRAIN_LAYER_TYPES as readonly string[]).includes(layer.type),
      layerId: layer.id,
      colorCss: (color) => colors.css(color),
    });
    el.style.filter = style.filter;
    el.style.textShadow = style.textShadow;
    el.style.backdropFilter = style.backdropFilter ?? "";
    for (const def of style.defs) if (def.kind === "grain") defineGrain(root, def.id, def.effect);
  };

  /** A filter (a shape with a backdrop) shows its backdrop only inside its figure: the core's clip over the layer's own box. A rectangle keeps its border radius instead. */
  const filterClip = (layer: Layer, outline: Outline): string => {
    if (!outline.preset || !layer.effects?.some((fx) => fx.kind === "backdrop")) return "";
    const d = filterClipPath({ geoShape: outline.preset }, { x: 0, y: 0, width: layer.box.width ?? 0, height: layer.box.height ?? 0 });
    return d === null ? "" : `path("${d}")`;
  };

  /**
   * Paints the blocks of a layer. `only` limits the pass to the blocks that changed
   * (their field names); without it every block is painted. A figure depends on
   * its fills, geometry and strokes together, so any of them repaints the figure.
   */
  const paintBlocks = (el: HTMLElement, layer: Layer, only?: ReadonlySet<string>) => {
    const has = (...keys: string[]) => !only || keys.some((k) => only.has(k));
    const isText = layer.type === "text";
    if (has("fills")) applyFills(el, layer, { colors, isText });
    if (has("opacity", "blend")) applyCompositing(el, layer);
    if (has("effects")) applyEffects(el, layer);
    if (layer.type === "text" && has("text")) applyText(el, layer, { lang, canvasWidth: width, fonts });
    const figure = has("fills", "geometry", "strokes");
    const outline = layer.type === "shape" ? (figure ? applyGeometry(el, layer, { colors }) : geometryOutline(layer.geometry)) : geometryOutline(undefined);
    if (has("effects", "geometry")) el.style.clipPath = filterClip(layer, outline);
    if (has("corners", "geometry")) applyCorners(el, layer, !!outline.round);
    if (has("strokes", "geometry", "fills")) applyStrokes(el, layer, { colors, isText, vector: !!outline.silhouette, rounded: !!outline.round || [layer.corners ?? 0].flat().some((c) => c > 0) });
    if (layer.type === "image" && has("image")) {
      el.querySelectorAll(":scope > img[data-oim-fill]").forEach((node) => node.remove());
      const picture = pictureOf(layer.image, lang);
      if (picture !== undefined) el.appendChild(pictureNode(el, { src: picture, fit: layer.image?.fit, crop: layer.image?.crop, filters: layer.image?.filters }));
    }
  };

  const paint = (layer: Layer, parent: HTMLElement, frame: Frame) => {
    // An image layer with no picture of its own is not painted: the file's base picture is the page's, behind the layers.
    if (layer.type === "image" && pictureOf(layer.image, lang) === undefined) return;
    const el = container.ownerDocument.createElement("div");
    el.dataset.oimId = layer.id;
    el.style.position = "absolute";
    applyBox(el, layer.box, frame);
    paintBlocks(el, layer);
    entries.set(layer.id, { el, layer, frame });
    for (const child of layer.children ?? []) paint(child, el, layer.box as Frame); // only groups have children, and a group is always sized
    parent.appendChild(el);
  };
  for (const layer of document.layers) paint(layer, root, canvas);
  container.appendChild(letterbox);

  // A move is written once when it starts a frame; the moves that follow in the same frame are kept and written once more, at the next frame.
  let frame: number | undefined;
  const pendingMoves = new Map<string, Box>();
  const flushMoves = () => {
    frame = undefined;
    for (const [id, box] of pendingMoves) {
      const entry = entries.get(id);
      if (entry) applyBox(entry.el, box, entry.frame);
    }
    pendingMoves.clear();
  };

  return {
    elementOf: (id) => entries.get(id)?.el ?? null,
    update(id, changes) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.layer = { ...entry.layer, ...changes } as Layer;
      if (changes.box) applyBox(entry.el, entry.layer.box, entry.frame);
      paintBlocks(entry.el, entry.layer, new Set(Object.keys(changes)));
    },
    setTransform(id, box) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.layer = { ...entry.layer, box } as Layer;
      if (frame === undefined) {
        applyBox(entry.el, box, entry.frame);
        frame = requestAnimationFrame(flushMoves);
      } else pendingMoves.set(id, box);
    },
    setMode: notYet("setMode"),
    play: notYet("play"),
    pause: notYet("pause"),
    seek: notYet("seek"),
    destroy() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      pendingMoves.clear();
      letterbox.remove();
      entries.clear();
    },
  };
}

/**
 * The palette a scene paints with. A role is a var() of the active palette; a colour
 * baked into an image (a pattern tile, a drawing) is that same palette's literal, so
 * both follow the reader's colour scheme when the document has light and dark.
 */
export function sceneColors(variables: OimDocument["variables"], palette: string | undefined, prefersDark: boolean): { colors: PaintColors; active: ReturnType<typeof resolvePalette> } {
  const palettes = palettesOf(variables);
  const defaultPalette = palette ?? variables?.defaults?.palette;
  const active = resolvePalette({ palettes, defaultPalette }, { requested: palette ?? null, prefersDark });
  return { colors: paintColors({ palettes, defaultPalette: active?.name ?? defaultPalette }), active };
}

