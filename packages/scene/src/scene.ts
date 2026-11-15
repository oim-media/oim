/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DYNAMIC_COLOR_ROLES, resolvePalette } from "@oim-media/core";
import { geometryOutline, paintColors, palettesOf, type Box, type Layer, type OimDocument, type PaintColors } from "@oim-media/core/v2";
import { applyBox, type Frame } from "./box.js";
import { applyCorners } from "./blocks/corners.js";
import { applyFills, pictureNode } from "./blocks/fills.js";
import { applyGeometry } from "./blocks/geometry.js";
import { pictureOf } from "./blocks/image.js";
import { applyStrokes } from "./blocks/strokes.js";
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

export function mount(container: HTMLElement, document: OimDocument, _options: SceneOptions = {}): Scene {
  const { width, height } = document.canvas;
  const root = container.ownerDocument.createElement("div");
  root.className = "oim-scene";
  Object.assign(root.style, { position: "relative", aspectRatio: `${width} / ${height}`, containerType: "inline-size" });

  const entries = new Map<string, Entry>();
  const canvas: Frame = { x: 0, y: 0, width, height };
  const palettes = palettesOf(document.variables);
  const defaultPalette = _options.palette ?? document.variables?.defaults?.palette;
  const colors: PaintColors = paintColors({ palettes, defaultPalette });
  // The active palette's roles become custom properties, so a colour bound to a role is a var() and a mode change needs no repaint.
  // With both light and dark palettes, the reader's colour scheme decides, as the player does.
  const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const active = resolvePalette({ palettes, defaultPalette }, { requested: _options.palette ?? null, prefersDark });
  for (const role of DYNAMIC_COLOR_ROLES) {
    const value = active?.colors[role];
    if (value) root.style.setProperty(`--oim-palette-${role}`, value);
  }
  // A block scene does not paint yet is ignored, and said once per block type, not per layer.
  for (const block of unsupportedUse(document)) console.warn(`[oim scene] "${block}" is not painted yet; it is ignored`);

  applyFills(root, document.canvas, { colors, isText: false });
  const lang = document.languages[0];
  const paint = (layer: Layer, parent: HTMLElement, frame: Frame) => {
    // An image layer with no picture of its own is not painted: the file's base picture is the page's, behind the layers.
    const picture = layer.type === "image" ? pictureOf(layer.image, lang) : undefined;
    if (layer.type === "image" && picture === undefined) return;
    const el = container.ownerDocument.createElement("div");
    el.dataset.oimId = layer.id;
    el.style.position = "absolute";
    applyBox(el, layer.box, frame);
    const isText = layer.type === "text";
    applyFills(el, layer, { colors, isText });
    const outline = layer.type === "shape" ? applyGeometry(el, layer, { colors }) : geometryOutline(undefined);
    applyCorners(el, layer, !!outline.round);
    applyStrokes(el, layer, { colors, isText, vector: !!outline.silhouette });
    if (picture !== undefined) pictureNode(el, { src: picture, fit: layer.image?.fit, crop: layer.image?.crop });
    entries.set(layer.id, { el, layer, frame });
    for (const child of layer.children ?? []) paint(child, el, layer.box as Frame); // only groups have children, and a group is always sized
    parent.appendChild(el);
  };
  for (const layer of document.layers) paint(layer, root, canvas);
  container.appendChild(root);

  return {
    elementOf: (id) => entries.get(id)?.el ?? null,
    update: notYet("update"),
    setTransform(id, box) {
      const entry = entries.get(id);
      if (!entry) return;
      applyBox(entry.el, box, entry.frame);
      entry.layer = { ...entry.layer, box } as Layer;
    },
    setMode: notYet("setMode"),
    play: notYet("play"),
    pause: notYet("pause"),
    seek: notYet("seek"),
    destroy() {
      root.remove();
      entries.clear();
    },
  };
}
