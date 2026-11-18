/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cropCss } from '../../../core/src/crop.js';
import { mediaFilterCss } from '../../../core/src/media-filters.js';
import { flipScale } from '../../../core/src/flip.js';
import { filterStyle } from './v2-layers.js';
import { silhouetteClip } from '../blocks/silhouette-clip.js';


/**
 * Image fill of a shape (contract 1.17.0). The photo sits in a box clipped by
 * the silhouette, under the stroke drawing. The URL goes into the `src`
 * property of an <img>, never into a CSS url(), so it cannot inject CSS.
 * Built once when the slot is built: no per-frame work.
 */
export function mountImageFill(
  slotEl: HTMLElement,
  paint: { crop?: { x: number; y: number; zoom: number }; flipX?: boolean; flipY?: boolean; filters?: Record<string, unknown> },
  silhouette: { d: string; viewBox: string; rect?: { rx: number; ry: number } },
  resolvedUrl: string,
  fallbackColor?: string
): void {
  const { svg, clipPath } = silhouetteClip(document, silhouette);

  const box = document.createElement('div');
  box.className = 'oim-image-fill';
  box.style.position = 'absolute';
  box.style.left = '0';
  box.style.top = '0';
  box.style.width = '100%';
  box.style.height = '100%';
  box.style.overflow = 'hidden';
  box.style.pointerEvents = 'none';
  box.style.clipPath = clipPath;
  box.appendChild(svg);

  const crop = cropCss(paint.crop ?? { x: 50, y: 50, zoom: 1 });
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.display = 'block';
  img.style.objectFit = crop.objectFit;
  img.style.objectPosition = crop.objectPosition;
  // The mirror goes on the photo only, inside the crop: the silhouette is never flipped.
  const flip = flipScale(paint.flipX, paint.flipY);
  img.style.transform = flip ? `${crop.transform} scale(${flip[0]}, ${flip[1]})`.trim() : crop.transform;
  img.style.transformOrigin = crop.transformOrigin;
  img.style.filter = mediaFilterCss(filterStyle(paint.filters)) ?? '';
  img.addEventListener('error', () => {
    box.remove();
    // The photo failed: the shape shows the colour under it.
    if (!fallbackColor) return;
    // A rectangle has no stroke figure: its colour is the slot's own background.
    if (silhouette.rect) {
      slotEl.style.backgroundColor = fallbackColor;
      return;
    }
    for (const child of Array.from(slotEl.children)) {
      if (child.tagName.toLowerCase() !== 'svg') continue;
      for (const stroke of Array.from(child.children)) stroke.setAttribute('fill', fallbackColor);
    }
  });
  img.src = resolvedUrl;
  box.appendChild(img);

  // Under the stroke drawing: the svg is already in the slot and comes after.
  slotEl.insertBefore(box, slotEl.firstChild);
}
