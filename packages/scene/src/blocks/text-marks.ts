/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The highlight and drop cap of a text, shared by the 1.x painter and the scene.
import { dropCapStyle, splitDropCap } from '../../../core/src/drop-cap.js';
import { renderMarkedText, type Marks } from './marked-text.js';

export function applyTextHighlight(el: HTMLElement, hl?: any): void {
  if (!hl?.enabled) return;
  const c = hl.color || 'rgba(245,158,11,.35)', m = hl.style === 'underline-thick', st = el.style;
  st.backgroundColor = m ? 'transparent' : c;
  if (m) st.boxShadow = `inset 0 -.4em 0 ${c}`;
  st.borderRadius = hl.style === 'pill' ? '9999px' : hl.style === 'box' ? '0' : `${hl.borderRadius ?? 3}px`;
  st.padding = `${hl.paddingY ?? 2}px ${hl.paddingX ?? 4}px`;
  st.boxDecorationBreak = (st as any).webkitBoxDecorationBreak = 'clone';
}

/**
 * The drop cap: the big first letter, then the rest of the text WITH its marks
 * (`text` is the stored text, tags and escapes included).
 */
export function applyDropCap(el: HTMLElement, text: string, dc?: any, marks?: Marks): boolean {
  if (!dc?.enabled || !text) return false;
  const { letter, rest } = splitDropCap(text, Object.keys(marks ?? {}));
  if (!letter) return false;
  const s = el.ownerDocument.createElement('span'), st = s.style;
  // One style for the three renderers (@oim-media/core drop-cap.ts).
  const d = dropCapStyle(dc);
  s.textContent = letter;
  st.float = 'left';
  st.fontSize = `${d.scale}em`;
  st.lineHeight = String(d.lineHeight);
  st.marginRight = `${d.marginRight}px`;
  if (d.fontFamily) st.fontFamily = d.fontFamily;
  if (d.color) st.color = d.color;
  st.fontWeight = String(d.fontWeight);
  st.userSelect = 'none';
  renderMarkedText(el, rest, marks);
  el.prepend(s);
  return true;
}
