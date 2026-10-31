/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The FORMAT's limits. A separate module, for a specific reason.
 *
 * `MAX_SLOTS` used to live in `schema.ts` with a comment saying it was declared there
 * «so the number exists once and reaches both places without being copied». It did not work:
 * the player copied it as the literal `150` in `security.ts`, because importing from
 * `schema.ts` drags zod into its package, and the player does not want zod. The debt
 * was not the copier's; it was the place where the constant lived.
 *
 * Nothing here has dependencies. Anyone can import it without dragging anything in.
 *
 * And the number belongs to the format, not to the deployment: the backend could raise
 * it with an environment variable, which let it sign files that the player
 * rejects as corrupt. A legitimately signed file that no reader
 * displays. Now the backend can only LOWER it.
 */

/**
 * How many layers a `.oim` supports.
 *
 * Three places enforce it, and all three must say the same thing: the schema of
 * `@oim-media/core`, the player's validation before painting, and the backend before
 * signing.
 */
export const MAX_SLOTS = 150;

/** Text marks (contract 1.11.0): tag names and how many styles a text may carry. */
export const MARK_NAME = /^[a-z][a-z0-9-]{0,23}$/;
export const MAX_MARKS = 8;
