/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The 1.x metadata the renderer walks, built from a 2.0 document. The renderer
// still reads slots; each one is painted from the 2.0 layer it names, which
// `rememberDocument` hands over without an upgrade.
import type { Layer, OimDocument, Variables } from '../../../core/src/v2/schema.js';
import { rememberDocument } from './v2-layers.js';
import { palettesOf } from '../../../core/src/v2/colors.js';
import { hasBaseLayer } from '../../../core/src/v2/base-layer.js';

export type LegacySlot = { id: string; type: string; style: Record<string, unknown>; content?: Record<string, string> };

export type LegacyMetadata = {
  canvas_width: number;
  canvas_height: number;
  languages: string[];
  slots: LegacySlot[];
  fonts?: OimDocument['fonts'];
  palettes?: Record<string, Record<string, string>>;
  defaultPalette?: string;
  /** The canvas paint, painted behind the layers: 1.x had none, its PNG was the background. */
  canvasFills?: OimDocument['canvas']['fills'];
};

/** A 2.0 size or width as 1.x wrote it: the value in px, and the px of each language that has its own. */
function perLanguagePx(value: unknown): { px?: string; byLang?: Record<string, string> } {
  if (typeof value === 'number') return { px: `${value}px` };
  if (value && typeof value === 'object' && 'value' in value) {
    const { value: base, modes } = value as { value: number; modes?: Record<string, number> };
    const byLang = Object.fromEntries(Object.entries(modes ?? {}).map(([lang, px]) => [lang, `${px}px`]));
    return { px: `${base}px`, byLang: Object.keys(byLang).length > 0 ? byLang : undefined };
  }
  return {};
}

/** The words and sizes of a text, which the language switch reads from the slot. */
function textFields(slot: LegacySlot, text: NonNullable<Layer['text']>): void {
  slot.content = text.content;
  const size = perLanguagePx(text.font?.size);
  const width = perLanguagePx(text.maxWidth);
  if (size.px) slot.style.fontSize = size.px;
  if (size.byLang) slot.style.fontSizes = size.byLang;
  if (width.px) slot.style.maxWidth = width.px;
  if (width.byLang) slot.style.maxWidths = width.byLang;
}

/** Slots in paint order: a group, then its children right after it, nested ones included. */
export function legacyView(document: OimDocument): LegacyMetadata {
  const slots: LegacySlot[] = [];
  const walk = (layers: Layer[], groupId?: string) => {
    for (const layer of layers) {
      // A mask is a shape that takes the role of masking its siblings (see upgrade/mask.ts);
      // an artistic text is a text with an artistic block (see upgrade/text.ts); a filter is a shape with a backdrop (see upgrade/effects.ts).
      const filter = layer.type === 'shape' && !!layer.effects?.some((fx) => fx.kind === 'backdrop');
      const type = layer.mask ? 'mask' : layer.text?.artistic ? 'artistic-text' : filter ? 'filter' : layer.type;
      const slot: LegacySlot = { id: layer.id, type, style: groupId ? { groupId } : {} };
      if (layer.text) textFields(slot, layer.text);
      slots.push(slot);
      walk(layer.children ?? [], layer.id);
    }
  };
  walk(document.layers);
  const view: LegacyMetadata = {
    canvas_width: document.canvas.width,
    canvas_height: document.canvas.height,
    languages: document.languages,
    slots,
  };
  // The embedded fonts are the file's own; the palettes are the variables, one mode per palette name.
  // The overlay sits over the base PNG: a file that shows its own picture already holds its canvas.
  if (document.canvas.fills?.length && !hasBaseLayer(document)) view.canvasFills = document.canvas.fills;
  if (document.fonts) view.fonts = document.fonts;
  const palettes = palettesOf(document.variables);
  if (palettes) view.palettes = palettes;
  if (document.variables?.defaults?.palette) view.defaultPalette = document.variables.defaults.palette;
  rememberDocument(view, document);
  return view;
}
