/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * How much the parallax enlarges a layer pinned to the edge is delegated to `@oim-media/core`.
 *
 * It used to live here, and the editor had a COPY in `src/lib/parallax/` -with
 * its lock file `parallax.lock`, which recorded the source commit and a hash per
 * file, plus a guard that compared them-. All of that machinery existed to keep
 * two copies identical that are no longer needed.
 *
 * Only what the player uses is re-exported. A generous re-export is a door
 * through which whatever is on the other side gets in: when the generative
 * engine was moved, a "for convenience" `export` pulled the entire catalog
 * -1.7 KB- into the CDN bundle.
 *
 * The module file is imported, not the package index, to avoid pulling in the
 * schema or zod.
 */
export { oversizeScale } from '../../../core/src/oversize.js';
