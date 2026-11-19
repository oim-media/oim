/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The CDN build's `upgrade`: a separate script next to the player, loaded once
// per page and only for a 1.x file. Same road as Lottie (lottie-external.ts).
import type { upgrade as Upgrade } from '../../../core/src/v2/upgrade.js';
import { OWN_SCRIPT_SRC } from './own-script.js';
import { createExternalScriptLoader } from './lottie-external.js';

declare const __OIM_UPGRADE_FILE__: string;

const GLOBAL = '__oimUpgrade';
const loaded = () => (globalThis as any)[GLOBAL] as typeof Upgrade | undefined;

const load = createExternalScriptLoader({
  scriptUrl: OWN_SCRIPT_SRC,
  file: `vendor/${typeof __OIM_UPGRADE_FILE__ !== 'undefined' ? __OIM_UPGRADE_FILE__ : 'oim-upgrade.js'}`,
  marker: 'data-oim-upgrade',
  read: () => loaded(),
});

export const upgrade: typeof Upgrade = (doc) => {
  const run = loaded();
  if (!run) throw new Error('[OimPlayer] upgrade called before ensureUpgrade()');
  return run(doc);
};

export function ensureUpgrade(): Promise<void> {
  return loaded() ? Promise.resolve() : load().then(() => undefined);
}
