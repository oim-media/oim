/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Where a layer's texture effect goes: on the layer's own pixels, never on
 * its whole box. The bug that settled it: an SVG with a transparent
 * background came out as a coloured square in the editor and the player (the
 * texture covered the box) and as a faint shape in the static export (which
 * already masked it). One rule for the three renderers: the texture overlay
 * is masked with the layer's content. Portable: a native renderer draws the
 * texture with "source-in" over the layer's alpha.
 *
 * Text layers keep their own path (the texture fills the glyphs).
 * Spec: docs/superpowers/specs/2026-10-10-contract-audit-design.md
 */

export interface TextureMask {
  /** CSS `mask-image` value. */
  image: string;
  /** CSS `mask-size` value. */
  size: string;
}

/** A source that is safe inside `url("…")`: data, blob or https, no quotes or breaks. */
const SAFE_URL = /^(data:image\/|blob:|https:\/\/)[^"'\\\n\r()]*$/;

/**
 * The CSS mask for a layer's texture overlay, or `null` when the layer's box
 * is already its silhouette (geometric shapes, containers).
 * `svg` is the layer's SVG markup; `image` its picture source with `fit`.
 */
export function layerTextureMask(layer: {
  type?: string;
  svg?: string;
  image?: string;
  fit?: "cover" | "contain" | "fill" | string;
}): TextureMask | null {
  if (layer.svg && /<svg[\s>]/i.test(layer.svg)) {
    return { image: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(layer.svg)}")`, size: "100% 100%" };
  }
  if (layer.type === "image" && layer.image && SAFE_URL.test(layer.image)) {
    const size = layer.fit === "contain" ? "contain" : layer.fit === "fill" ? "100% 100%" : "cover";
    return { image: `url("${layer.image}")`, size };
  }
  return null;
}
