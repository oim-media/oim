/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Entry of the separate pattern script the CDN player loads on demand.
import { generatePatternSVG, patternTileUri, isMultiColorPattern, resolvePatternColors } from '../../../core/src/patterns.js';

(globalThis as any).__oimPatterns = { generatePatternSVG, patternTileUri, isMultiColorPattern, resolvePatternColors };
