/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The 1.x style keys that need saying out loud: the ones 2.0 drops on purpose,
// and the ones real files carry although the 1.x contract never declared them.

/** Declared in 1.x and dropped in 2.0: nobody wrote them, or they were CSS inside the file. */
export const RETIRED_STYLE_KEYS = ["shader_fx", "outline", "verticalAlign"] as const;

/** Carried by published files without being in the 1.x contract. Each one is converted. */
export const UNDECLARED_STYLE_KEYS = [
  "geoType",
  "childIds",
  "parallax",
  "sceneLoop",
  "loopDepth",
  "svgLayers",
  "borderColor",
  "borderWidth",
  "letterSpacing",
  "bold",
  "italic",
  "underline",
  "color",
  "backgroundFit",
  "backgroundGenerative",
  "backgroundPatternType",
  "backgroundPatternDirection",
  "backgroundPatternScale",
  "backgroundPatternSpeed",
] as const;
