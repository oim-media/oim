/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * URL of the script this player was loaded from, captured while the bundle is
 * being evaluated. `document.currentScript` is only set during that first,
 * synchronous run (and is always null for ES modules), so it cannot be read
 * later, when a .oim first asks for Lottie. Files published next to the player
 * (vendor/) are resolved against it, so self-hosted copies work too.
 */
export const OWN_SCRIPT_SRC: string | null =
  typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement
    ? document.currentScript.src || null
    : null;
