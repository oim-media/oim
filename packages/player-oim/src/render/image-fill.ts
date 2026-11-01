/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cropCss } from '../../../core/src/crop.js';
import { resolveCssColor } from '../../../core/src/dynamic-colors.js';
import { mediaFilterCss } from '../../../core/src/media-filters.js';
import { flipScale } from '../../../core/src/flip.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let sequence = 0;

/**
 * Image fill of a shape (contract 1.17.0). The photo sits in a box clipped by
 * the silhouette, under the stroke drawing. The URL goes into the `src`
 * property of an <img>, never into a CSS url(), so it cannot inject CSS.
 * Built once when the slot is built: no per-frame work.
 */
export function mountImageFill(
  slotEl: HTMLElement,
  style: Record<string, any>,
  silhouette: { d: string; viewBox: string; rect?: { rx: number; ry: number } },
  resolvedUrl: string
): void {
  const id = `oim-image-fill-${++sequence}`;
  // The clip is in objectBoundingBox units: the silhouette maps onto the unit box.
  const [x0, y0, width, height] = silhouette.viewBox.trim().split(/\s+/).map(Number);
  const scale = width === height ? `scale(${1 / width})` : `scale(${1 / width} ${1 / height})`;
  const transform = x0 || y0 ? `${scale} translate(${-x0} ${-y0})` : scale;

  const box = document.createElement('div');
  box.className = 'oim-image-fill';
  box.style.position = 'absolute';
  box.style.left = '0';
  box.style.top = '0';
  box.style.width = '100%';
  box.style.height = '100%';
  box.style.overflow = 'hidden';
  box.style.pointerEvents = 'none';
  box.style.clipPath = `url(#${id})`;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.setAttribute('id', id);
  clip.setAttribute('clipPathUnits', 'objectBoundingBox');
  // A rectangle takes its corner radius as a fraction of the box (rx, ry are in objectBoundingBox units).
  const shape = document.createElementNS(SVG_NS, silhouette.rect ? 'rect' : 'path');
  if (silhouette.rect) {
    shape.setAttribute('x', '0');
    shape.setAttribute('y', '0');
    shape.setAttribute('width', '1');
    shape.setAttribute('height', '1');
    shape.setAttribute('rx', String(silhouette.rect.rx));
    shape.setAttribute('ry', String(silhouette.rect.ry));
  } else {
    shape.setAttribute('d', silhouette.d);
    shape.setAttribute('transform', transform);
  }
  clip.appendChild(shape);
  svg.appendChild(clip);
  box.appendChild(svg);

  const crop = cropCss(style.fillImageCrop ?? { x: 50, y: 50, zoom: 1 });
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.display = 'block';
  img.style.objectFit = crop.objectFit;
  img.style.objectPosition = crop.objectPosition;
  // The mirror goes on the photo only, inside the crop: the silhouette is never flipped.
  const flip = flipScale(style.fillImageFlipX, style.fillImageFlipY);
  img.style.transform = flip ? `${crop.transform} scale(${flip[0]}, ${flip[1]})`.trim() : crop.transform;
  img.style.transformOrigin = crop.transformOrigin;
  img.style.filter = mediaFilterCss(style) ?? '';
  img.addEventListener('error', () => {
    box.remove();
    // The photo failed: the shape goes back to its flat fillColor.
    const color = resolveCssColor(style.fillColorRole, style.fillColor);
    if (!color) return;
    // A rectangle has no stroke figure: its colour is the slot's own background.
    if (silhouette.rect) {
      slotEl.style.backgroundColor = color;
      return;
    }
    for (const child of Array.from(slotEl.children)) {
      if (child.tagName.toLowerCase() !== 'svg') continue;
      for (const stroke of Array.from(child.children)) stroke.setAttribute('fill', color);
    }
  });
  img.src = resolvedUrl;
  box.appendChild(img);

  // Under the stroke drawing: the svg is already in the slot and comes after.
  slotEl.insertBefore(box, slotEl.firstChild);
}
