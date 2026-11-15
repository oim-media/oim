/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveLineHeight } from "@oim-media/core";
import { typographyCss, type Layer } from "@oim-media/core/v2";

export type TextContext = { lang: string };

/**
 * A text's words and typography, for one language. The words are set as plain
 * text. Typography follows the player: canvas px sizes, a box of at most 80 % of
 * the canvas unless the text states a width, white space kept, and the default
 * alignment left. Colour and stroke come from the fills and strokes blocks.
 */
export function applyText(el: HTMLElement, layer: Pick<Layer, "text">, ctx: TextContext): void {
  const text = layer.text;
  el.textContent = text?.content?.[ctx.lang] ?? "";
  const css = typographyCss(layer, ctx.lang) ?? {};
  const style = el.style;
  style.whiteSpace = "pre-wrap";
  style.overflowWrap = "break-word";
  style.wordBreak = "break-word";
  style.padding = "0 0.25em 0 0";
  style.textAlign = text?.align ?? "left";
  // A column whose lines sit in the middle of the box, across it by the alignment, as the player lays them out.
  style.display = "flex";
  style.flexDirection = "column";
  style.justifyContent = "center";
  style.alignItems = text?.align === "right" ? "flex-end" : text?.align === "center" ? "center" : "flex-start";
  style.lineHeight = String(resolveLineHeight({ lineHeight: text?.lineHeight }));
  style.maxWidth = css.maxWidth ?? "80%";
  style.fontSize = css.fontSize ?? "16px";
  style.fontFamily = css.fontFamily ?? "";
  style.fontWeight = css.fontWeight ?? "";
  style.fontStyle = css.fontStyle ?? "";
  style.letterSpacing = css.letterSpacing ?? "";
  style.textTransform = css.textTransform ?? "";
}
