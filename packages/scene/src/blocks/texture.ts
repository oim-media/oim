/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Effect, PaintColors } from "@oim-media/core/v2";
import { TEXTURE_CATALOG } from "../../../core/src/effects/catalog.js";
import type { TexturePreset } from "../../../core/src/effects/types.js";
import { layerTextureMask } from "../../../core/src/effects/texture-mask.js";
import { inkMargin } from "../../../core/src/typography.js";
import { paintCss } from "../../../core/src/v2/paint-css.js";

type Texture = Omit<Extract<Effect, { kind: "texture" }>, "color"> & { color?: string };

export type TextureContext = {
  /** A text takes the texture inside its glyphs; any other layer, over its own pixels. */
  text: boolean;
  /** The layer's first fill: under a text's texture, its colour or gradient shows. */
  under: unknown;
  colors: PaintColors;
  /** The text's resolved line height, for the ink margin of a clipped fill. */
  lineHeight?: number;
  /** What `layerTextureMask` needs to keep the texture on the layer's pixels. */
  mask: Parameters<typeof layerTextureMask>[0];
  /** Canvas pixels in the painter's length (px in the player, cqw in the scene). */
  len: (px: number) => string;
};

/** A texture effect: a tile from the core's catalogue, blended over the layer. Shared by the 1.x painter and the scene. */
export function applyTextureEffect(el: HTMLElement, eff: Texture, ctx: TextureContext): void {
  const texDef = TEXTURE_CATALOG[eff.preset as TexturePreset];
  if (!texDef) return;
  const scale = eff.scale || 1.0;
  const w = ctx.len(texDef.tileWidth * scale);
  const h = ctx.len(texDef.tileHeight * scale);
  const tile = `url("${texDef.getDataUri(eff.color, eff.intensity)}")`;
  const blend = eff.blend || texDef.defaultBlend || "overlay";
  if (ctx.text) {
    // Under the grain: the layer's colour, or its gradient.
    const under = ctx.under as { kind?: string; value?: never } | undefined;
    const baseColor = (under?.kind === "color" && ctx.colors.css(under.value as never)) || "#18181b";
    const underGradient = under?.kind === "gradient" ? paintCss(under as never, { colors: ctx.colors }).backgroundImage : undefined;
    el.style.backgroundImage = `${tile}, ${underGradient ?? `linear-gradient(${baseColor}, ${baseColor})`}`;
    el.style.backgroundRepeat = "repeat, no-repeat";
    el.style.backgroundSize = `${w} ${h}, 100% 100%`;
    el.style.backgroundBlendMode = underGradient ? `${blend}, normal` : blend;
    el.style.webkitBackgroundClip = "text";
    el.style.backgroundClip = "text";
    (el.style as CSSStyleDeclaration & { webkitTextFillColor: string }).webkitTextFillColor = "transparent";
    el.style.color = "transparent";
    // Same margin as a clipped fill: without it the descenders of a tight line
    // height (a «p» at line height 1) were left unfilled while the stroke drew them.
    const ink = ctx.lineHeight === undefined ? 0 : inkMargin(ctx.lineHeight);
    if (ink > 0) {
      el.style.setProperty("padding-top", `${ink}em`, "important");
      el.style.setProperty("padding-bottom", `${ink}em`, "important");
    }
    return;
  }
  const overlay = el.ownerDocument.createElement("div");
  overlay.className = "oim-effect-texture";
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    borderRadius: "inherit",
    mixBlendMode: blend,
    opacity: String((eff.intensity !== undefined ? eff.intensity : texDef.defaultIntensity) / 100),
    backgroundImage: tile,
    backgroundRepeat: "repeat",
    backgroundSize: `${w} ${h}`,
    zIndex: "1",
  });
  // On the layer's own pixels, not its box (core layerTextureMask): an SVG with
  // a transparent background came out as a coloured square.
  const mask = layerTextureMask(ctx.mask);
  if (mask) {
    const ms = overlay.style as CSSStyleDeclaration & { webkitMaskImage: string; webkitMaskSize: string; webkitMaskRepeat: string; webkitMaskPosition: string };
    ms.maskImage = ms.webkitMaskImage = mask.image;
    ms.maskSize = ms.webkitMaskSize = mask.size;
    ms.maskRepeat = ms.webkitMaskRepeat = "no-repeat";
    ms.maskPosition = ms.webkitMaskPosition = "center";
  }
  el.appendChild(overlay);
}
