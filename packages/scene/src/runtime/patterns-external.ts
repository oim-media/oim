/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The CDN build's pattern tiles: a separate script, fetched only when a
// document has a pattern. Stands in for core/src/patterns.ts.
import type * as Patterns from '../../../core/src/patterns.js';
import { OWN_SCRIPT_SRC } from './own-script.js';
import { createExternalScriptLoader } from './lottie-external.js';

declare const __OIM_PATTERNS_FILE__: string;

type Lib = Pick<typeof Patterns, 'generatePatternSVG' | 'patternTileUri' | 'isMultiColorPattern' | 'resolvePatternColors'>;
const loaded = () => (globalThis as any).__oimPatterns as Lib | undefined;

export const loadPatterns = createExternalScriptLoader({
  scriptUrl: OWN_SCRIPT_SRC,
  file: `vendor/${typeof __OIM_PATTERNS_FILE__ !== 'undefined' ? __OIM_PATTERNS_FILE__ : 'oim-patterns.js'}`,
  marker: 'data-oim-patterns',
  read: () => loaded(),
});

// Until the script is loaded a pattern paints nothing rather than throwing mid-render.
export const generatePatternSVG: Lib['generatePatternSVG'] = (o) => loaded()?.generatePatternSVG(o) ?? '';
export const patternTileUri: Lib['patternTileUri'] = (...a) => loaded()?.patternTileUri(...a) ?? '';
export const isMultiColorPattern: Lib['isMultiColorPattern'] = (s) => loaded()?.isMultiColorPattern(s) ?? false;
export const resolvePatternColors: Lib['resolvePatternColors'] = (...a) =>
  loaded()?.resolvePatternColors(...a) ?? ({ fgColor: '#000000', bgColor: 'transparent' } as ReturnType<Lib['resolvePatternColors']>);
