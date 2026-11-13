/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Box } from "@oim-media/core/v2";

/** A share of a length as a CSS percentage, rounded so the style stays readable. */
export const percent = (part: number, whole: number): string => `${whole ? +((part / whole) * 100).toFixed(4) : 0}%`;

/** Where a box sits inside its parent. Boxes are in canvas units, wherever the layer is nested. */
export type Frame = { x: number; y: number; width: number; height: number };

export function applyBox(el: HTMLElement, box: Box, parent: Frame): void {
  const s = el.style;
  s.left = percent(box.x - parent.x, parent.width);
  s.top = percent(box.y - parent.y, parent.height);
  s.width = percent(box.width, parent.width);
  s.height = percent(box.height, parent.height);
  const transform = [
    box.rotation ? `rotate(${box.rotation}deg)` : "",
    box.flipX ? "scaleX(-1)" : "",
    box.flipY ? "scaleY(-1)" : "",
  ].filter(Boolean);
  s.transform = transform.join(" ");
}
