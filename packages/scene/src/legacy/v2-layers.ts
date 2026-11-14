/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The bridge of the migration: the renderer still walks the 1.x slots, and
// reads from the 2.0 layer of each one the blocks already moved to 2.0.
import { upgrade } from './upgrade-entry.js';
import type { Box, Geometry, Layer } from '../../../core/src/v2/schema.js';
import type { PaintColors } from '../../../core/src/v2/paint-css.js';
import { resolveCssColor, resolvePalette } from '../../../core/src/dynamic-colors.js';
import { resolveByLang } from './localizedEntries.js';

const cache = new WeakMap<object, Map<string, Layer>>();

/** Every layer of the document as 2.0, by id, nested ones included. Computed once per metadata object. */
export function v2LayersOf(metadata: object): Map<string, Layer> {
  let layers = cache.get(metadata);
  if (layers) return layers;
  layers = new Map();
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      layers!.set(layer.id, layer);
      walk(layer.children ?? []);
    }
  };
  // Without `upgrade` (its script failed to load) the map stays empty and every
  // slot is painted by its 1.x road.
  try { walk(upgrade(metadata).document.layers); } catch (err) { console.warn('[OimPlayer] 2.0 view unavailable:', err); }
  cache.set(metadata, layers);
  return layers;
}

/**
 * How the renderer paints a 2.0 colour: a palette binding stays a `var()` so a
 * mode change needs no repaint; drawn-in paints (patterns) take the default
 * palette's value, since an image cannot hold a `var()`.
 */
export function paintColors(metadata: { palettes?: Record<string, Record<string, string>>; defaultPalette?: string }): PaintColors {
  const isVar = (v: unknown): v is { var: string; fallback?: string } => !!v && typeof v === 'object' && typeof (v as { var?: unknown }).var === 'string';
  return {
    css: (v) => (isVar(v) ? resolveCssColor(v.var, v.fallback) : typeof v === 'string' ? resolveCssColor(null, v) : '') || undefined,
    literal: (v) => (isVar(v)
      ? (resolvePalette(metadata)?.colors as Record<string, string> | undefined)?.[v.var] ?? resolveCssColor(null, v.fallback)
      : typeof v === 'string' ? resolveCssColor(null, v) : '') || undefined,
  };
}

/** How far a box moves, as CSS translate shares of its own size, so its anchor lands on x, y. */
export function anchorShift(box: Box): [string, string] {
  const anchor = box.anchor ?? 'top-left';
  const x = /left/.test(anchor) ? '0%' : /right/.test(anchor) ? '-100%' : '-50%';
  const y = /^top/.test(anchor) ? '0%' : /^bottom/.test(anchor) ? '-100%' : '-50%';
  return [x, y];
}

/** A 2.0 scalar resolved for one language: its exception for that mode, else its value. */
function forLanguage(value: unknown, lang: string): number | undefined {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    const { value: base, modes } = value as { value: unknown; modes?: Record<string, unknown> };
    const own = modes?.[lang];
    return typeof own === 'number' ? own : typeof base === 'number' ? base : undefined;
  }
  return undefined;
}

/**
 * The CSS typography of a 2.0 text, for one language. Lengths are canvas units,
 * which the overlay paints 1:1 as px. Absent fields are absent: the caller
 * keeps its defaults.
 */
export function typographyCss(layer: Layer | undefined, lang: string): Record<string, string> | undefined {
  const text = layer?.text;
  if (!text) return undefined;
  const css: Record<string, string> = {};
  const size = forLanguage(text.font?.size, lang);
  if (size !== undefined) css.fontSize = `${+size.toFixed(4)}px`;
  const maxWidth = forLanguage(text.maxWidth, lang);
  if (maxWidth !== undefined) css.maxWidth = `${+maxWidth.toFixed(4)}px`;
  if (text.font?.family) css.fontFamily = text.font.family;
  if (text.font?.weight !== undefined) css.fontWeight = String(text.font.weight);
  if (text.font?.italic) css.fontStyle = 'italic';
  if (text.letterSpacing !== undefined) css.letterSpacing = `${text.letterSpacing}px`;
  if (text.transform) css.textTransform = text.transform;
  if (text.decoration) css.textDecoration = text.decoration;
  return css;
}

/**
 * A 2.0 filter set as the 1.x style fields, so the one function all three
 * renderers share (`mediaFilterCss`) still writes the CSS. Every key is
 * present, so spreading it over a 1.x style replaces that style's filters.
 */
export function filterStyle(filters: Record<string, unknown> | undefined): Record<string, unknown> {
  const f = filters ?? {};
  const percent = (v: unknown) => (typeof v === 'number' ? +(v * 100).toFixed(6) : undefined);
  return {
    filterPreset: f.preset,
    filterBlur: f.blur,
    filterBrightness: percent(f.brightness),
    filterContrast: percent(f.contrast),
    filterSaturate: percent(f.saturate),
    filterHueRotate: f.hueRotate,
  };
}

/**
 * The 1.x mask fields of a 2.0 mask layer, so the mask helpers keep one input.
 * Every field is written, absent ones as `undefined`, so nothing of 1.x shows through.
 */
export function maskStyle(layer: Layer): Record<string, unknown> {
  const mask = layer.mask ?? {};
  const geometry = layer.geometry as { kind?: string; name?: string; paths?: { d: string }[] } | undefined;
  const named: Record<string, string> = { rect: 'rectangle', ellipse: 'circle', line: 'line' };
  const shape = geometry?.kind === 'preset' ? geometry.name : geometry?.kind === 'paths' ? 'custom' : named[geometry?.kind ?? ''];
  const color = (value: unknown) => (typeof value === 'string'
    ? { role: undefined, literal: value }
    : value && typeof value === 'object' ? { role: (value as { var?: string }).var, literal: (value as { fallback?: string }).fallback } : { role: undefined, literal: undefined });
  const fill = layer.fills?.[0] as { kind?: string; value?: unknown } | undefined;
  const bg = color(fill?.kind === 'color' ? fill.value : undefined);
  const stroke = layer.strokes?.[0] as { paint?: { kind?: string; value?: unknown }; width?: number } | undefined;
  const line = color(stroke?.paint?.kind === 'color' ? stroke.paint.value : undefined);
  return {
    maskMode: mask.mode === 'cutout' ? 'cutout' : 'window',
    maskFeather: mask.feather,
    maskCoverage: mask.scope === 'group' ? 'container' : 'canvas',
    maskShape: shape,
    maskSvgPath: geometry?.kind === 'paths' ? geometry.paths?.map((p) => p.d).join(' ') : undefined,
    geoShape: undefined,
    svgPath: undefined,
    maskBgColor: bg.literal,
    maskBgColorRole: bg.role,
    fillColorRole: undefined,
    maskStrokeColor: line.literal,
    maskStrokeColorRole: line.role,
    strokeColorRole: undefined,
    maskStrokeWidth: stroke?.width,
    cuts: (layer.extensions as { studio?: { maskCuts?: unknown } } | undefined)?.studio?.maskCuts,
  };
}

/** The picture a 2.0 image shows in one language: its own exception, else the principal; the base PNG paints none. */
export function imageSrc(src: string | { value: string; modes?: Record<string, string> }, lang: string): string {
  const pick = typeof src === 'string' ? src : resolveByLang(src.modes ?? {}, lang) ?? src.value;
  return pick === 'oim:base' ? '' : pick;
}

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
export function drawingSvg(geometry: Paths, link: { fill?: string; stroke?: string }, tile = false): string {
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
  for (const p of geometry.paths) {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', p.d);
    const fill = safeColor(p.fill === 'currentColor' ? link.fill ?? 'currentColor' : p.fill);
    const stroke = safeColor(p.stroke === 'currentColor' ? link.stroke ?? 'currentColor' : p.stroke);
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
export function drawingLink(layer: Layer, color: (v: unknown) => string | undefined): { fill?: string; stroke?: string } {
  const flat = (paint: unknown) => (paint && typeof paint === 'object' && (paint as { kind?: unknown }).kind === 'color' ? color((paint as { value: unknown }).value) : undefined);
  const fill = flat(layer.fills?.[0]);
  const stroke = flat(layer.strokes?.[0]?.paint);
  return { fill: fill ?? stroke, stroke: stroke ?? fill };
}
