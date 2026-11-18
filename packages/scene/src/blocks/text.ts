/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveLineHeight } from "@oim-media/core";
import { typographyCss, type Layer } from "@oim-media/core/v2";

import { embeddedFontFamily } from "./fonts.js";
import { renderMarkedText } from "./marked-text.js";
import { applyDropCap, applyTextHighlight } from "./text-marks.js";

export type TextContext = {
  lang: string;
  /** The canvas width in canvas units: sizes are written against it, so they scale with the canvas. */
  canvasWidth: number;
  /** Family -> the registered name of the font embedded in the file. */
  fonts?: Map<string, string>;
};

/** A length in canvas px, as a share of the canvas width (cqw is measured on the scene root). */
export const canvasLength = (px: string | undefined, canvasWidth: number): string | undefined =>
  px === undefined ? undefined : `${+((parseFloat(px) / canvasWidth) * 100).toFixed(4)}cqw`;
const inCanvas = canvasLength;

/**
 * A text's words and typography, for one language. The words are set as plain
 * text. Typography follows the player: canvas px sizes, a box of at most 80 % of
 * the canvas unless the text states a width, white space kept, and the default
 * alignment left. Sizes are canvas units, written in cqw. Colour and stroke come
 * from the fills and strokes blocks.
 */
export function applyText(el: HTMLElement, layer: Pick<Layer, "text">, ctx: TextContext): void {
  const text = layer.text;
  const words = text?.content?.[ctx.lang] ?? "";
  if (!text?.marks && !text?.highlight && !text?.dropCap) el.textContent = words;
  else {
    // One block holds the runs, so the marks' spans flow as one paragraph inside the flex column.
    // shortcut: highlight padding and the drop cap's margin are px, right at 1:1; write them in cqw when a scaled file shows it.
    el.textContent = "";
    const body = el.ownerDocument.createElement("div");
    body.style.alignSelf = "stretch"; // the whole box, as the player's text wrapper: a block highlight spans it
    applyTextHighlight(body, text.highlight);
    if (!applyDropCap(body, words, text.dropCap, text.marks)) renderMarkedText(body, words, text.marks);
    el.appendChild(body);
  }
  const css = typographyCss(layer, ctx.lang) ?? {};
  const style = el.style;
  style.whiteSpace = "pre-wrap";
  style.overflowWrap = "break-word";
  style.wordBreak = "break-word";
  style.padding = "0 0.25em 0 0";
  // The italic room sits outside the box, as the player shifts it back: the lines centre on the box itself.
  style.boxSizing = "content-box";
  style.textAlign = text?.align ?? "left";
  // A column whose lines sit in the middle of the box, across it by the alignment, as the player lays them out.
  style.display = "flex";
  style.flexDirection = "column";
  style.justifyContent = "center";
  style.alignItems = text?.align === "right" ? "flex-end" : text?.align === "center" ? "center" : "flex-start";
  style.lineHeight = String(resolveLineHeight({ lineHeight: text?.lineHeight }));
  style.maxWidth = inCanvas(css.maxWidth, ctx.canvasWidth) ?? "80%";
  style.fontSize = inCanvas(css.fontSize ?? "16px", ctx.canvasWidth) ?? "";
  const family = layer.text?.font?.family;
  style.fontFamily = (family && ctx.fonts && embeddedFontFamily(family, ctx.fonts)) || (css.fontFamily ?? "");
  style.fontWeight = css.fontWeight ?? "";
  style.fontStyle = css.fontStyle ?? "";
  style.letterSpacing = inCanvas(css.letterSpacing, ctx.canvasWidth) ?? "";
  style.textTransform = css.textTransform ?? "";
  style.textDecoration = css.textDecoration ?? "";
}
