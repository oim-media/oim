/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer } from "@oim-media/core/v2";
import { buildArtisticTextModelFromLayer, generateArtisticTextSvgString } from "./artisticText.js";
import { embeddedFontFamily } from "./fonts.js";

export type ArtisticContext = { lang: string; literal: (value: unknown) => string | undefined; fonts?: Map<string, string> };

/** An artistic text: the SVG of the artistic-text painter, centred in the layer's box, in place of the words. */
export function applyArtistic(el: HTMLElement, layer: Layer, ctx: ArtisticContext): void {
  el.textContent = "";
  Object.assign(el.style, { display: "flex", alignItems: "center", justifyContent: "center" });
  const model = buildArtisticTextModelFromLayer(layer as never, ctx.lang, ctx.literal as never);
  // The SVG appends ", sans-serif" itself; the embedded name goes first.
  const embedded = ctx.fonts && embeddedFontFamily(model.fontFamily, ctx.fonts);
  if (embedded) model.fontFamily = embedded.replace(/, sans-serif$/, "");
  const svg = new DOMParser().parseFromString(generateArtisticTextSvgString(model, layer.id), "image/svg+xml").documentElement;
  el.appendChild(el.ownerDocument.importNode(svg, true));
}
