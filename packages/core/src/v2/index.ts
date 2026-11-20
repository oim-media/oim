/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The 2.0 document. Players paint 2.0 only since 1.35.0; a 1.x file is converted
// once by `upgrade()` and signed again. The normative text is packages/spec/CANONICAL_SPEC_2.md.
export * from "./layer-blocks.js";
export * from "./schema.js";
export * from "./upgrade.js";
export type { UpgradeContext } from "./upgrade/context.js";
export * from "./paint-css.js";
export * from "./texture-css.js";
export * from "./resources.js";
// The shared outline of a shape and the test for a document that shows its base picture.
export * from "./geometry-outline.js";
export * from "./base-layer.js";
export * from "./colors.js";
export * from "./typography.js";
export * from "./svg-gradient.js";
export * from "./trim.js";
export * from "./extensions.js";
