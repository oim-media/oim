/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from "node:path";

/**
 * A real .oim made in the editor and signed by the backend. Its signature verifies
 * against the keys embedded in the player. Tests that need "some valid signed .oim"
 * read this one, from core and from the player alike.
 */
export const REFERENCE_OIM = join(__dirname, "reference.oim.png");
