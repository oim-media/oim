/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The geometry of the catalogue's shapes is delegated to `@oim-media/core`.
 *
 * It used to live here, and the editor had a COPY in its own library folder, with
 * a lock file (`parallax.lock`) recording the source commit and a hash per file, and a guard
 * that compared them. All that machinery existed to keep two copies in sync
 * that no longer need to exist.
 *
 * Only what the player uses is re-exported. A generous re-export is a door through which
 * whatever is on the other side comes in: when the generative engine was moved, an
 * `export` "for convenience" pulled the whole catalogue (1.7 KB) into the bundle
 * served from the CDN.
 *
 * The module file is imported, not the package index, so as not to
 * drag in the schema or zod.
 */
export { shapeDrawing, pointsToAttribute } from '../../../core/src/geoShapes.js';
