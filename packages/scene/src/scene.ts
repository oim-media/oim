/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Box, Layer, OimDocument } from "@oim-media/core/v2";
import { applyBox, type Frame } from "./box.js";

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

type Entry = { el: HTMLElement; layer: Layer };

const notYet = (name: string) => () => {
  throw new Error(`scene.${name} is not implemented yet`);
};

export function mount(container: HTMLElement, document: OimDocument, _options: SceneOptions = {}): Scene {
  const { width, height } = document.canvas;
  const root = container.ownerDocument.createElement("div");
  root.className = "oim-scene";
  Object.assign(root.style, { position: "relative", aspectRatio: `${width} / ${height}`, containerType: "inline-size" });

  const entries = new Map<string, Entry>();
  const paint = (layer: Layer, parent: HTMLElement, frame: Frame) => {
    const el = container.ownerDocument.createElement("div");
    el.dataset.oimId = layer.id;
    el.style.position = "absolute";
    applyBox(el, layer.box, frame);
    entries.set(layer.id, { el, layer });
    for (const child of layer.children ?? []) paint(child, el, layer.box as Frame); // only groups have children, and a group is always sized
    parent.appendChild(el);
  };
  const canvas: Frame = { x: 0, y: 0, width, height };
  for (const layer of document.layers) paint(layer, root, canvas);
  container.appendChild(root);

  return {
    elementOf: (id) => entries.get(id)?.el ?? null,
    update: notYet("update"),
    setTransform: notYet("setTransform"),
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
