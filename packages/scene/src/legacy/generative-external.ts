/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The CDN build's generative fills: a separate script, fetched only when a
// document has one. Stands in for core/src/generative/index.ts.
import type { renderGenerativeSVG as Render } from '../../../core/src/generative/index.js';
import { OWN_SCRIPT_SRC } from './own-script.js';
import { createExternalScriptLoader } from './lottie-external.js';

declare const __OIM_GENERATIVE_FILE__: string;

const loaded = () => (globalThis as any).__oimGenerative as { renderGenerativeSVG: typeof Render } | undefined;

export const loadGenerative = createExternalScriptLoader({
  scriptUrl: OWN_SCRIPT_SRC,
  file: `vendor/${typeof __OIM_GENERATIVE_FILE__ !== 'undefined' ? __OIM_GENERATIVE_FILE__ : 'oim-generative.js'}`,
  marker: 'data-oim-generative',
  read: () => loaded(),
});

/** Empty until the script is loaded: the fill paints nothing rather than throwing mid-render. */
export const renderGenerativeSVG: typeof Render = (config, canvas) => loaded()?.renderGenerativeSVG(config, canvas) ?? '';
