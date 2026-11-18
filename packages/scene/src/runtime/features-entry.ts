/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Where the renderer loads the optional parts a document needs. Tests and the
// npm build have them inline; the CDN build aliases this module to
// `features-external.ts`, which fetches each one as a separate file.
import type { Features } from './features.js';

/** Resolves when every part in `needs` can be called. Here they already can. */
export function ensureFeatures(_needs: Features): Promise<void> {
  return Promise.resolve();
}
