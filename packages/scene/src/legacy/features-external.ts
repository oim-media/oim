/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The CDN build's `ensureFeatures`: fetches the scripts a document needs, in parallel.
import type { Features } from './features.js';
import { loadGenerative } from './generative-external.js';
import { loadPatterns } from './patterns-external.js';

export function ensureFeatures(needs: Features): Promise<void> {
  const loads: Promise<unknown>[] = [];
  if (needs.generative) loads.push(loadGenerative());
  if (needs.patterns) loads.push(loadPatterns());
  return Promise.all(loads).then(() => undefined);
}
