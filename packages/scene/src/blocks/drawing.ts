/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A 2.0 drawing (`geometry.kind: 'paths'`) as SVG markup, coloured from its layer.
import type { Geometry, Layer } from '../../../core/src/v2/schema.js';
import { svgGradientAttrs } from '../../../core/src/v2/svg-gradient.js';
import type { Gradient } from '../../../core/src/v2/upgrade/gradient.js';

type Paths = Extract<Geometry, { kind: 'paths' }>;

// A path's colour comes from the file unvalidated: nothing that could end the declaration
// or load a resource reaches a style, whatever the CSSOM of the host does with it.
const safeColor = (c: string | undefined) => (c && !/[;{}<>"]|url\(|expression\(/i.test(c) ? c : undefined);

/**
 * A 2.0 drawing as SVG markup. A path's `currentColor` is the layer's colour: as a
 * fill its first fill, else its first stroke; as a stroke the other way round.
 * Colours go through CSSOM: a role is a var(), and an invalid value is dropped,
 * not injected into the markup.
 */
let gradientIds = 0;

export function drawingSvg(geometry: Paths, link: DrawingLink, tile = false): string {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', geometry.viewBox.join(' '));
  // A tile is an image: it needs its own size, and literal colours the pattern recolouring can find.
  svg.setAttribute('width', tile ? String(geometry.viewBox[2]) : '100%');
  svg.setAttribute('height', tile ? String(geometry.viewBox[3]) : '100%');
  if (tile) svg.setAttribute('xmlns', NS);
  else {
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.setProperty('display', 'block');
  }
  // A gradient stroke goes on every path, one gradient across the viewBox, as the editor draws it.
  let strokeUrl: string | undefined;
  if (link.strokeGradient) {
    const { tag, attrs, stops } = svgGradientAttrs(link.strokeGradient, geometry.viewBox);
    const grad = svg.appendChild(document.createElementNS(NS, 'defs')).appendChild(document.createElementNS(NS, tag));
    grad.id = `oim-sg-${++gradientIds}`;
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    for (const [k, v] of Object.entries(attrs)) grad.setAttribute(k, String(v));
    for (const st of stops) {
      const stop = grad.appendChild(document.createElementNS(NS, 'stop'));
      stop.setAttribute('offset', st.offset);
      stop.setAttribute('stop-color', safeColor(st.color) ?? '#000');
    }
    strokeUrl = `url(#${grad.id})`;
  }
  for (const p of geometry.paths) {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', p.d);
    const fill = safeColor(p.fill === 'currentColor' ? link.fill ?? 'currentColor' : p.fill);
    const stroke = strokeUrl ?? safeColor(p.stroke === 'currentColor' ? link.stroke ?? 'currentColor' : p.stroke);
    if (tile) {
      // Inside a data URI an attribute cannot reach the page.
      el.setAttribute('fill', fill ?? 'none');
      if (stroke) el.setAttribute('stroke', stroke);
    } else {
      el.setAttribute('fill', 'none');
      if (fill) el.style.setProperty('fill', fill);
      if (stroke) el.style.setProperty('stroke', stroke);
    }
    if (p.strokeWidth !== undefined) el.setAttribute('stroke-width', String(p.strokeWidth));
    if (p.fillRule) el.setAttribute('fill-rule', p.fillRule);
    if (p.cap) el.setAttribute('stroke-linecap', p.cap);
    if (p.join) el.setAttribute('stroke-linejoin', p.join);
    if (p.opacity !== undefined) el.setAttribute('opacity', String(p.opacity));
    if (p.transform) el.setAttribute('transform', `matrix(${p.transform.join(' ')})`);
    svg.appendChild(el);
  }
  return svg.outerHTML;
}

/** The colour a drawing's `currentColor` takes, as CSS or as a literal for a baked tile. */
export type DrawingLink = { fill?: string; stroke?: string; strokeGradient?: Gradient };

export function drawingLink(layer: Layer, color: (v: unknown) => string | undefined): DrawingLink {
  const flat = (paint: unknown) => (paint && typeof paint === 'object' && (paint as { kind?: unknown }).kind === 'color' ? color((paint as { value: unknown }).value) : undefined);
  const fill = flat(layer.fills?.[0]);
  const paint = layer.strokes?.[0]?.paint as { kind?: string; gradient?: Gradient } | undefined;
  const stroke = flat(paint);
  // shortcut: a conic stroke falls back to the flat colour, add it if an editor ever offers one.
  const g = paint?.kind === 'gradient' && paint.gradient?.type !== 'conic' ? paint.gradient : undefined;
  const strokeGradient = g && { ...g, stops: g.stops.map((s) => ({ ...s, color: color(s.color) ?? s.color })) };
  return { fill: fill ?? stroke, stroke: stroke ?? fill, ...(strokeGradient && { strokeGradient }) };
}
