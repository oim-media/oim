/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Image crop (contract 1.15.0): which part of the image shows inside its
 * frame. Always based on "cover", so the frame is never left with a gap.
 * `x`/`y` (0-100) are the image point that sits on the same frame point, as
 * CSS `object-position`; `zoom` (1-10) scales around that point.
 *
 * Two forms of one rule: cropPlacement for Canvas2D (the static export),
 * cropCss for the editor and the player. With `transform-origin` on the
 * `object-position` point, that point stays fixed while scaling, so both
 * frame the image the same way (crop.test.ts checks it).
 */
export interface ImageCrop {
  x: number;
  y: number;
  zoom: number;
}

export function cropPlacement(
  frame: { width: number; height: number },
  image: { width: number; height: number },
  crop: ImageCrop
): { dx: number; dy: number; dw: number; dh: number } {
  const s = Math.max(frame.width / image.width, frame.height / image.height) * crop.zoom;
  const dw = image.width * s;
  const dh = image.height * s;
  return { dx: (frame.width - dw) * (crop.x / 100), dy: (frame.height - dh) * (crop.y / 100), dw, dh };
}

export function cropCss(crop: ImageCrop): { objectFit: "cover"; objectPosition: string; transform: string; transformOrigin: string } {
  const at = `${crop.x}% ${crop.y}%`;
  return { objectFit: "cover", objectPosition: at, transform: `scale(${crop.zoom})`, transformOrigin: at };
}
