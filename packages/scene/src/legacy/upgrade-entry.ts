/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Where the renderer gets `upgrade`. Tests and the npm build import it as is;
// the CDN build aliases this module to `upgrade-external.ts`, which fetches it
// as a separate file, so a page that only shows 2.0 files never downloads it.
import { upgrade as run } from '../../../core/src/v2/upgrade.js';

export const upgrade = run;

/** Resolves when `upgrade` can be called. Here it already can. */
export function ensureUpgrade(): Promise<void> {
  return Promise.resolve();
}
