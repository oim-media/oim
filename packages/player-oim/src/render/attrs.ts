/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Contract 1.23.0 renames the player's data-oim-* flags to English. Each flag is
// written under both names until 2.0.0, so pages styling or scripting the old
// Spanish names keep working.

export function setFlag(el: Element, name: string, legacyName: string, value = ""): void {
  el.setAttribute(name, value);
  el.setAttribute(legacyName, value);
}
