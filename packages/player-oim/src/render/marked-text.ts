/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Paints a text with marks (contract 1.11.0): a text node per plain run and a
 * `<span data-mark>` per marked one, styled by `markStyle`. The syntax is read
 * only by @oim-media/core (`parseMarks`); this file just turns runs into DOM, the
 * same way the editor's canvas does.
 * Spec: docs/superpowers/specs/2026-10-10-text-marks-design.md
 */

import { parseMarks, plainText, markStyle } from "../../../core/src/text-marks.js";
import type { TextMark } from "../../../core/src/schema.js";

export type Marks = Record<string, TextMark> | undefined;

/** The text without tags or escapes, for what cannot hold marks (animations, drop cap). */
export function plainOf(text: string, marks: Marks): string {
  return plainText(text, Object.keys(marks ?? {}));
}

export function renderMarkedText(el: HTMLElement, text: string, marks: Marks): void {
  el.textContent = "";
  for (const run of parseMarks(text, Object.keys(marks ?? {}))) {
    const mark = run.mark ? marks?.[run.mark] : undefined;
    if (!run.mark || !mark) {
      el.appendChild(document.createTextNode(run.text));
      continue;
    }
    const span = document.createElement("span");
    span.dataset.mark = run.mark;
    span.textContent = run.text;
    const s = markStyle(mark);
    const st = span.style as CSSStyleDeclaration & { webkitBoxDecorationBreak?: string };
    if (s.color) st.color = s.color;
    if (s.fontWeight) st.fontWeight = String(s.fontWeight);
    if (s.fontStyle) st.fontStyle = s.fontStyle;
    if (s.underline) st.textDecoration = "underline";
    const h = s.highlight;
    if (h) {
      if (h.style === "underline-thick") {
        st.boxShadow = `inset 0 -.4em 0 ${h.color}`;
      } else {
        st.backgroundColor = h.color;
      }
      st.borderRadius = h.style === "pill" ? "9999px" : h.style === "box" ? "0" : `${h.borderRadius}px`;
      st.padding = `${h.paddingY}px ${h.paddingX}px`;
      st.boxDecorationBreak = "clone";
      st.webkitBoxDecorationBreak = "clone";
    }
    el.appendChild(span);
  }
}
