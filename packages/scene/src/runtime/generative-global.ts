/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Entry of the separate generative script the CDN player loads on demand.
import { renderGenerativeSVG } from '../../../core/src/generative/index.js';

(globalThis as any).__oimGenerative = { renderGenerativeSVG };
