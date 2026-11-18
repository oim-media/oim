/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer } from "@oim-media/core/v2";
import { ensureParallaxKeyframes, infiniteLayerPlan, TRACK_CLASS } from "../../../core/src/parallaxCss.js";

/**
 * A layer that scrolls forever: the core's plan, the same track and copies the
 * player builds. The box clips the track (trap #6c), and the loop is a CSS
 * animation, so there is no frame loop to put to sleep (trap #6b).
 *
 * shortcut: laid once when the layer is painted; an `update` of the loop or the box does not rebuild the track.
 */
export function applyLoop(el: HTMLElement, layer: Layer, canvasWidth: number, len: (px: number) => string): void {
  const loop = layer.motion?.loop;
  if (!loop) return;
  const width = layer.box.width ?? canvasWidth;
  const plan = infiniteLayerPlan({ speedPxSec: loop.speedPxSec, direction: loop.direction ?? "right_to_left", mirror: loop.mirror ?? true, pauseOnHover: !!loop.pauseOnHover }, width, canvasWidth);
  if (!plan.duplicate) return;
  const doc = el.ownerDocument;
  ensureParallaxKeyframes(doc);
  // The plan speaks canvas pixels; inside the scene a canvas length is a share of its width.
  const scaled = (v: string) => v.replace(/(-?\d+(?:\.\d+)?)px/g, (_, n: string) => len(Number(n)));
  const style = (node: HTMLElement, styles: Record<string, string>) => { for (const [k, v] of Object.entries(styles)) node.style.setProperty(k, scaled(v)); };

  const track = doc.createElement("div");
  track.className = TRACK_CLASS;
  track.style.height = "100%";
  style(track, plan.container);
  const first = doc.createElement("div");
  Object.assign(first.style, { position: "relative", height: "100%" });
  // The fills move to the pieces, every longhand: Chrome reads back an empty `background` shorthand when the longhands do not serialise as one.
  for (const prop of Array.from({ length: el.style.length }, (_, i) => el.style.item(i)).filter((p) => p.startsWith("background"))) {
    first.style.setProperty(prop, el.style.getPropertyValue(prop));
    el.style.removeProperty(prop);
  }
  first.append(...el.childNodes);
  for (let i = 0; i < plan.copies; i++) {
    const piece = i === 0 ? first : (first.cloneNode(true) as HTMLElement);
    style(piece, plan.copy);
    if (i % 2 === 1) style(piece, plan.secondCopy);
    track.appendChild(piece);
  }
  el.style.overflow = "hidden";
  el.appendChild(track);
}
