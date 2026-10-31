/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cropCss } from './crop.js';
import { resolveCssColor } from './dynamicColors.js';
import { mediaFilterCss } from '../../../core/src/media-filters.js';
import { flipScale } from './flip.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let secuencia = 0;

/**
 * Image fill of a shape (contract 1.17.0). The photo sits in a box clipped by
 * the silhouette, under the stroke drawing. The URL goes into the `src`
 * property of an <img>, never into a CSS url(), so it cannot inject CSS.
 * Built once when the slot is built: no per-frame work.
 */
export function montarRellenoDeImagen(
  slotEl: HTMLElement,
  style: Record<string, any>,
  silueta: { d: string; viewBox: string; rect?: { rx: number; ry: number } },
  urlResuelta: string
): void {
  const id = `oim-image-fill-${++secuencia}`;
  // The clip is in objectBoundingBox units: the silhouette maps onto the unit box.
  const [x0, y0, ancho, alto] = silueta.viewBox.trim().split(/\s+/).map(Number);
  const escala = ancho === alto ? `scale(${1 / ancho})` : `scale(${1 / ancho} ${1 / alto})`;
  const transform = x0 || y0 ? `${escala} translate(${-x0} ${-y0})` : escala;

  const caja = document.createElement('div');
  caja.className = 'oim-image-fill';
  caja.style.position = 'absolute';
  caja.style.left = '0';
  caja.style.top = '0';
  caja.style.width = '100%';
  caja.style.height = '100%';
  caja.style.overflow = 'hidden';
  caja.style.pointerEvents = 'none';
  caja.style.clipPath = `url(#${id})`;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.setAttribute('id', id);
  clip.setAttribute('clipPathUnits', 'objectBoundingBox');
  // A rectangle takes its corner radius as a fraction of the box (rx, ry are in objectBoundingBox units).
  const figura = document.createElementNS(SVG_NS, silueta.rect ? 'rect' : 'path');
  if (silueta.rect) {
    figura.setAttribute('x', '0');
    figura.setAttribute('y', '0');
    figura.setAttribute('width', '1');
    figura.setAttribute('height', '1');
    figura.setAttribute('rx', String(silueta.rect.rx));
    figura.setAttribute('ry', String(silueta.rect.ry));
  } else {
    figura.setAttribute('d', silueta.d);
    figura.setAttribute('transform', transform);
  }
  clip.appendChild(figura);
  svg.appendChild(clip);
  caja.appendChild(svg);

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
    caja.remove();
    // The photo failed: the shape goes back to its flat fillColor.
    const color = resolveCssColor(style.fillColorRole, style.fillColor);
    if (!color) return;
    // A rectangle has no stroke figure: its colour is the slot's own background.
    if (silueta.rect) {
      slotEl.style.backgroundColor = color;
      return;
    }
    for (const hijo of Array.from(slotEl.children)) {
      if (hijo.tagName.toLowerCase() !== 'svg') continue;
      for (const trazo of Array.from(hijo.children)) trazo.setAttribute('fill', color);
    }
  });
  img.src = urlResuelta;
  caja.appendChild(img);

  // Under the stroke drawing: the svg is already in the slot and comes after.
  slotEl.insertBefore(caja, slotEl.firstChild);
}
