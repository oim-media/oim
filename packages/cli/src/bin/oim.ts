#!/usr/bin/env node
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';
import { inspectCommand } from '../inspect.js';
import { verifyCommand } from '../verify.js';
import { extractCommand } from '../extract.js';
import { packCommand } from '../pack.js';
import { upgradeCommand } from '../upgrade.js';

const program = new Command();

program
  .name('oim')
  .description('Official command-line tool for the OIM ecosystem')
  .version('1.36.7');

program
  .command('inspect')
  .description('Inspect interactive metadata, layers, fonts, and signature of an OIM file')
  .argument('<file>', 'Path to the .oim or .png file')
  .action(async (file: string) => {
    await inspectCommand(file);
  });

program
  .command('verify')
  .description('Validate file integrity against the schema and verify its cryptographic signature')
  .argument('<file>', 'Path to the .oim or .png file')
  .option('--json', 'Output result in structured JSON format')
  .action(async (file: string, options: { json?: boolean }) => {
    await verifyCommand(file, options);
  });

program
  .command('extract')
  .description('Separate the clean base PNG image from the interactive metadata JSON')
  .argument('<file>', 'Path to the .oim or .png file')
  .option('-i, --out-image <path>', 'Output path for the base PNG image')
  .option('-m, --out-meta <path>', 'Output path for the metadata JSON')
  .action(async (file: string, options: { outImage?: string; outMeta?: string }) => {
    await extractCommand(file, options);
  });

program
  .command('pack')
  .description('Package a base PNG image with interactive metadata into an .oim.png file')
  .argument('<image>', 'Path to the base PNG image')
  .requiredOption('-m, --meta <json>', 'Path to the metadata JSON file')
  .option('-o, --output <path>', 'Output path for the packaged file')
  .option('--sign', 'Package and sign via POST /v1/oim/package (requires Enterprise API key)')
  .option('--api-key <key>', 'Enterprise API key for X-API-Key (or OIM_API_KEY env var)')
  .option('--endpoint <url>', 'Packaging/signing service endpoint URL')
  .action(async (image: string, options: any) => {
    await packCommand(image, options);
  });

program
  .command('upgrade')
  .description('Upgrade an OIM 1.x file to Format 2.0 (unsigned)')
  .argument('<file>', 'Path to the .oim.png file')
  .option('-o, --output <path>', 'Output path for the 2.0 file')
  .action(async (file: string, options: { output?: string }) => {
    await upgradeCommand(file, options);
  });

program.parse(process.argv);
