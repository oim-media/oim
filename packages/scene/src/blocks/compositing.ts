/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer } from "@oim-media/core/v2";

/** A layer's opacity and blend mode. The scene root isolates the blending, so a layer blends with the layers under it, not the page. */
export function applyCompositing(el: HTMLElement, layer: Pick<Layer, "opacity" | "blend">): void {
  el.style.opacity = layer.opacity !== undefined && layer.opacity !== 1 ? String(layer.opacity) : "";
  el.style.mixBlendMode = layer.blend ?? "";
}
