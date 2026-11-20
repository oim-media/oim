/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { upgrade } from '../../../core/src/v2/upgrade.js';

/** The player paints 2.0 only: a test written against a 1.x literal feeds its upgraded form. */
export const upgradeFixture = (legacy: any) => upgrade(structuredClone(legacy)).document;
