/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Entry of the separate `upgrade` script the CDN player loads for 1.x files.
import { upgrade } from '../../../core/src/v2/upgrade.js';

(globalThis as any).__oimUpgrade = upgrade;
