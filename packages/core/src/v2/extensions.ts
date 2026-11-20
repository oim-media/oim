/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A document lists the extensions it cannot be read without (`extensionsRequired`).
// The reference reader implements none, so every one of them is unsupported and the
// file is not painted (the player fires `oim:error` with `code: "unsupported-extension"`).

export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set();

export function unsupportedRequired(document: { extensionsRequired?: readonly string[] }): string[] {
  return (document.extensionsRequired ?? []).filter((name) => !SUPPORTED_EXTENSIONS.has(name));
}
