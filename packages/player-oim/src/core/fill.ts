/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A layer's fill is delegated to `@oim-media/core`.
 *
 * It was duplicated with a REAL divergence, not a cosmetic one: the editor
 * inferred the type from the color -`fillType || (fillColor ? "color" : "none")`-
 * and the player did not. A layer with `fillColor` and no `fillType` was painted
 * in the editor but came out WITH NO FILL in the viewer. The inference was kept,
 * because the other version discards data the file does carry.
 *
 * `getContainerFillCss` went along with it: an alias marked `@deprecated` with
 * ZERO measured consumers in both repositories.
 *
 * The module file is imported rather than the package index, so the schema and
 * zod are not pulled into the CDN bundle.
 */
export { getFillCss, patternLayerCss, shapeMaskCss, svgSilhouetteMaskCss } from '../../../core/src/fill.js';
export type { Shape, CSSProperties } from '../../../core/src/fill.js';
