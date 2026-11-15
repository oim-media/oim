/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer } from "@oim-media/core/v2";

/**
 * Rounded corners of a box: one radius for all four, or four in the order
 * top-left, top-right, bottom-right, bottom-left. A round figure keeps its own rounding.
 */
export function applyCorners(el: HTMLElement, layer: Pick<Layer, "corners">, round: boolean): void {
  el.style.borderRadius = "";
  const corners = layer.corners;
  if (corners === undefined || round) return;
  el.style.borderRadius = (Array.isArray(corners) ? corners : [corners]).map((c) => `${c}px`).join(" ");
}
