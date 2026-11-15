/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The 2.0 document, still a draft. Nothing here is read by a player yet; the
// published format is the one the package root describes.
export * from "./layer-blocks.js";
export * from "./schema.js";
export * from "./upgrade.js";
export type { UpgradeContext } from "./upgrade/context.js";
export * from "./paint-css.js";
export * from "./resources.js";
// The shared outline of a shape and the test for a document that shows its base picture.
export * from "./geometry-outline.js";
export * from "./base-layer.js";
export * from "./colors.js";
export * from "./typography.js";
