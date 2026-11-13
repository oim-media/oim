/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Named palettes become variables with one value per palette. The colours of
// a layer already point at them (see `colorOf`), so switching palette is
// switching one mode.

import type { Variables } from "../schema.js";
import { asObject, type UpgradeContext, type V1Object } from "./context.js";

export function convertVariables(ctx: UpgradeContext, meta: V1Object, languages: string[]): Variables | undefined {
  const palettes = asObject(ctx.take(meta, "palettes")) ?? {};
  const preferred = ctx.take(meta, "defaultPalette");

  const names = Object.keys(palettes).filter((name) => asObject(palettes[name]));
  if (names.length === 0) return undefined;

  const values: Record<string, Record<string, string>> = {};
  for (const name of names) {
    for (const [role, color] of Object.entries(asObject(palettes[name]) ?? {})) {
      if (typeof color === "string" && color) (values[role] ??= {})[name] = color;
    }
  }
  const variables: Variables = { modes: { palette: names, language: languages }, values };
  if (typeof preferred === "string" && names.includes(preferred)) variables.defaults = { palette: preferred };
  return variables;
}
