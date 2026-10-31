/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The parallax CSS and its infinite track are delegated to `@oim-media/core`.
 *
 * They used to live here, and the editor kept a COPY of them with its own lock
 * file, `parallax.lock`, which recorded the source commit and a hash per file,
 * plus a guard that compared them. All that machinery existed only to keep two
 * copies in sync that no longer need to exist.
 *
 * Only what the player uses is re-exported. A generous re-export is a door
 * through which whatever sits on the other side gets in: when the generative
 * engine was moved, a "for convenience" `export` pulled the entire catalog
 * -1.7 KB- into the CDN bundle.
 *
 * The module file is imported rather than the package index, so the schema and
 * zod are not pulled in.
 */
export { infiniteLayerPlan, TRACK_CLASS, CSS_PARALLAX, ensureParallaxKeyframes } from '../../../core/src/parallaxCss.js';
export type { InfiniteLayer } from '../../../core/src/parallaxCss.js';
