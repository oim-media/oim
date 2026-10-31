/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Who may re-edit a `.oim` is delegated to `@oim-media/core`.
 *
 * It used to live here, and the editor had a COPY in `src/lib/parallax/` (with its
 * lock file `parallax.lock`, which recorded the source commit and a hash per file, and a
 * guard that compared them). All that machinery existed to keep two copies in sync
 * that are no longer needed.
 *
 * Only what the player uses is re-exported. A generous re-export is a door through which
 * whatever is on the other side gets in: when the generative engine moved, a
 * `export` «for convenience» pulled the whole catalog (-1.7 KB) into the CDN
 * bundle.
 *
 * The module file is imported, not the package index, so as not to drag in the schema
 * or zod.
 */
export { permissionOf, signatureStamp } from '../../../core/src/reeditPermission.js';
