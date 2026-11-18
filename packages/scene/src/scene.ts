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
import { defineGrain, defsOf } from "./blocks/grain.js";
import { duotoneFilter } from "./blocks/duotone.js";
import { applyCutoutMask, applyWindowMask } from "./blocks/mask.js";
import { applyArtistic } from "./blocks/artistic.js";
import { readEmbeddedFonts, registerEmbeddedFonts } from "./blocks/fonts.js";
import { pictureOf } from "./blocks/image.js";
import { applyStrokes } from "./blocks/strokes.js";
import { applyCompositing } from "./blocks/compositing.js";
import { applyText } from "./blocks/text.js";
import { applyTextureEffect } from "./blocks/texture.js";
import { resolveLineHeight } from "../../core/src/typography.js";
import { animationFrames, animationTiming, canAnimate, isEntrance } from "./blocks/animations.js";
import { applyEntrance, ENTRANCE_MS, entranceFrames } from "./blocks/presets.js";
import type { EntranceEffect } from "../../core/src/text-effects.js";
import { bindInteractions, resolveActions, type StateAction } from "./blocks/interactions.js";
import { applyLoop } from "./blocks/motion.js";
import { REVEAL_DEFAULT, revealFrames } from "../../core/src/reveal.js";
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

  // Inside the root (a size container), a canvas length is a share of its width.
  const tileSize = (px: number) => { const v = `${+((px / width) * 100).toFixed(4)}cqw`; return `${v} ${v}`; };
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

  // The root is the canvas: a tile is a share of its width and height.
  applyFills(root, document.canvas, { colors, isText: false, width, height, size: (px) => `${+((px / width) * 100).toFixed(4)}% ${+((px / height) * 100).toFixed(4)}%` });
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
    if (style.defs.some((def) => def.kind === "duotone")) {
      // One filter per layer, as the player names it; a layer with a duotone backdrop sees the layers under it through it.
      const id = `duotone-filter-${layer.id.replace(/[^\w-]/g, "_")}`;
      const defs = defsOf(root);
      if (!defs.querySelector(`#${id}`)) defs.appendChild(duotoneFilter(root.ownerDocument, id));
      el.style.backdropFilter = `url(#${id})`;
    }
    el.querySelectorAll(":scope > .oim-effect-texture").forEach((node) => node.remove());
    for (const def of style.defs) {
      if (def.kind === "grain") defineGrain(root, def.id, def.effect);
      else if (def.kind === "texture") {
        const color = def.effect.color === undefined ? undefined : colors.literal(def.effect.color);
        applyTextureEffect(el, { ...def.effect, color }, {
          text: layer.type === "text",
          under: layer.fills?.[0],
          colors,
          lineHeight: resolveLineHeight({ lineHeight: layer.text?.lineHeight }),
          mask: { type: layer.type },
          len,
        });
      }
    }
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
    if (has("fills", "box")) applyFills(el, layer, { colors, isText, size: tileSize, width: layer.box.width, height: layer.box.height });
    if (has("opacity", "blend")) applyCompositing(el, layer);
    if (has("visible")) el.style.display = layer.visible === false ? "none" : "";
    if (has("effects")) applyEffects(el, layer);
    if (layer.type === "text" && has("text")) {
      if (layer.text?.artistic) applyArtistic(el, layer, { lang, literal: colors.literal, fonts });
      else applyText(el, layer, { lang, canvasWidth: width, fonts });
    }
    const figure = has("fills", "geometry", "strokes");
    const outline = layer.type === "shape" ? (figure ? applyGeometry(el, layer, { colors }) : geometryOutline(layer.geometry)) : geometryOutline(undefined);
    if (has("effects", "geometry")) el.style.clipPath = filterClip(layer, outline);
    if (has("corners", "geometry")) applyCorners(el, layer, !!outline.round);
    if (has("strokes", "geometry", "fills")) applyStrokes(el, layer, { colors, isText, vector: !!outline.silhouette, rounded: !!outline.round || [layer.corners ?? 0].flat().some((c) => c > 0) });
    // A window mask paints a frame around its outline instead of its own box; a cutout is not painted yet.
    if (layer.mask && layer.mask.mode !== "cutout" && has("mask", "fills", "strokes", "geometry", "box")) applyWindowMask(el, layer, { canvas: { width, height }, colors });
    if (layer.type === "image" && has("image")) {
      el.querySelectorAll(":scope > img[data-oim-fill]").forEach((node) => node.remove());
      const picture = pictureOf(layer.image, lang);
      if (picture !== undefined) el.appendChild(pictureNode(el, { src: picture, fit: layer.image?.fit, crop: layer.image?.crop, filters: layer.image?.filters }));
    }
  };

  // --- time: every animation is WAAPI or CSS, so play/pause reach them all and no frame loop is left running.
  let paused = !!_options.paused;
  const len = (px: number) => `${+((px / width) * 100).toFixed(4)}cqw`;
  const animate = (el: HTMLElement, frames: Keyframe[], timing: KeyframeAnimationOptions): Animation | undefined => {
    if (typeof el.animate !== "function") return undefined;
    const run = el.animate(frames, timing);
    // At rest a loop is its first frame (an endless run cannot finish); anything else, its last.
    if (paused) timing.iterations === Infinity ? run.cancel() : run.finish?.();
    return run;
  };
  const animationsOf = (layer: Layer, on: string) => (layer.animations ?? []).filter((a) => a.on === on && canAnimate(a));
  const bindAnimations = (el: HTMLElement, layer: Layer) => {
    for (const a of [...animationsOf(layer, "load"), ...animationsOf(layer, "loop")]) {
      if (isEntrance(a)) {
        // shortcut: an entrance replaces the text's marks with plain units; split the marked runs when a file has both.
        // One block holds the units, so they flow as one paragraph inside the text's flex column.
        const body = el.ownerDocument.createElement("div");
        body.style.alignSelf = "stretch";
        const words = el.textContent ?? "";
        el.replaceChildren(body);
        const frames = entranceFrames(a.preset as EntranceEffect);
        const stagger = typeof a.params?.speed === "number" ? a.params.speed : undefined;
        applyEntrance(body, words, a.preset as EntranceEffect, stagger, (a.delay ?? 0) / 1000, (span, start) =>
          void animate(span, frames, { duration: ENTRANCE_MS, delay: start * 1000, easing: "linear", fill: "both" }));
        continue;
      }
      animate(el, animationFrames(a, len), animationTiming(a));
    }
    const hover = animationsOf(layer, "hover");
    if (!hover.length) return;
    const runs: Animation[] = [];
    el.addEventListener("pointerenter", () => {
      if (paused) return;
      if (runs.length) for (const r of runs) { r.playbackRate = 1; r.play(); }
      else for (const a of hover) { const r = animate(el, animationFrames(a, len), { ...animationTiming(a), duration: a.duration || 200 }); if (r) runs.push(r); }
    });
    el.addEventListener("pointerleave", () => { for (const r of runs) r.reverse(); });
  };

  /** Shows or hides a layer with its `enter` animation (the 1.x fade when it has none); paused, at once. */
  const setVisible = (id: string, visible: boolean) => {
    const entry = entries.get(id);
    if (!entry || (entry.layer.visible !== false) === visible) return;
    entry.layer = { ...entry.layer, visible } as Layer;
    const { el } = entry;
    const enter = animationsOf(entry.layer, "enter")[0];
    const frames = enter ? animationFrames(enter, len) : revealFrames(REVEAL_DEFAULT.effect, true);
    const timing: KeyframeAnimationOptions = enter
      ? { ...animationTiming(enter), fill: "none" }
      : { duration: visible ? REVEAL_DEFAULT.durationIn : REVEAL_DEFAULT.durationOut, easing: REVEAL_DEFAULT.easing };
    if (visible) {
      el.style.display = "";
      if (!paused) animate(el, frames, timing);
      return;
    }
    const run = paused ? undefined : animate(el, [...frames].reverse(), timing);
    const done = () => { if (entry.layer.visible === false) el.style.display = "none"; };
    if (run) run.onfinish = done; else done();
  };

  /** Runs a chain of actions in order; a hover's leave reverts its show/hide/toggle. */
  const runActions = (actions: StateAction[], revert: boolean) => {
    const flip: Record<string, string> = { show: "hide", hide: "show" };
    const list = revert ? actions.filter((a) => a.type !== "setText" && a.type !== "play").map((a) => ({ ...a, type: flip[a.type] ?? a.type })).reverse() : actions;
    for (const action of list) {
      const entry = entries.get(action.target);
      if (!entry) continue;
      if (action.type === "play") {
        for (const a of animationsOf(entry.layer, "action")) if (!paused) animate(entry.el, animationFrames(a, len), { ...animationTiming(a), fill: "none" });
        continue;
      }
      const { visibility, texts } = resolveActions([action], { [action.target]: entry.layer.visible !== false });
      for (const [id, v] of Object.entries(visibility)) setVisible(id, v);
      for (const [id, value] of Object.entries(texts)) {
        const t = entries.get(id)?.layer.text;
        if (t) api.update(id, { text: { ...t, content: { ...t.content, [lang]: value } } } as Partial<Layer>);
      }
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
    applyLoop(el, layer, width, len);
    bindInteractions(el, layer.interactions, runActions);
    bindAnimations(el, layer);
    for (const child of layer.children ?? []) paint(child, el, layer.box as Frame); // only groups have children, and a group is always sized
    parent.appendChild(el);
  };
  for (const layer of document.layers) {
    // shortcut: a cutout clips the layers before it at the top level only; one inside a group is not painted yet.
    if (layer.mask?.mode === "cutout") applyCutoutMask(root, layer, { width, height });
    else paint(layer, root, canvas);
  }
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

  const animations = () => root.getAnimations?.({ subtree: true }) ?? [];
  // A paused scene also stills its CSS loops, which started with the element.
  if (paused) for (const a of animations()) a.pause();
  const api: Scene = {
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
    play() { paused = false; for (const a of animations()) a.play(); },
    pause() { paused = true; for (const a of animations()) a.pause(); },
    seek: notYet("seek"),
    destroy() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      pendingMoves.clear();
      letterbox.remove();
      entries.clear();
    },
  };
  return api;
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

