/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, existsSync } from 'node:fs';
import { extractOIM, permissionOf } from '@oim-media/core';
import pc from 'picocolors';
import { verifySignature } from './crypto.js';

export async function inspectCommand(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    console.error(pc.red(`Error: File "${filePath}" not found.`));
    process.exit(1);
  }

  try {
    const fileBytes = readFileSync(filePath);
    const blob = new Blob([fileBytes], { type: 'image/png' });
    const { metadata, imageHash } = await extractOIM(blob);

    console.log();
    console.log(pc.bold(pc.cyan('╔════════════════════════════════════════════════════════════╗')));
    console.log(pc.bold(pc.cyan('║               OIM METADATA INSPECTOR                       ║')));
    console.log(pc.bold(pc.cyan('╚════════════════════════════════════════════════════════════╝')));
    console.log();

    console.log(`${pc.bold('File:')}          ${filePath}`);
    console.log(`${pc.bold('Size:')}          ${(fileBytes.length / 1024).toFixed(1)} KB`);

    if (!metadata) {
      console.log(pc.yellow('\n⚠ This file does not contain interactive OIM metadata (standard PNG image).'));
      return;
    }

    const version = metadata.oim || metadata.version || metadata.oim_version || 'unknown';
    const docId = metadata.oim_id || metadata.ovm_id || '(no id)';
    const title = metadata.name || '(untitled)';
    const slots = metadata.layers || metadata.slots || metadata.elements || [];

    console.log(`${pc.bold('OIM Version:')}   ${pc.green(version)}`);
    console.log(`${pc.bold('Document ID:')}   ${docId}`);
    console.log(`${pc.bold('Title:')}         ${title}`);
    console.log(`${pc.bold('Reedit:')}        ${permissionOf(metadata)}`);

    // Detected languages
    const langsSet = new Set<string>();
    if (Array.isArray(metadata.languages)) {
      metadata.languages.forEach((l: string) => langsSet.add(l.toUpperCase()));
    }
    for (const slot of slots) {
      if (slot.content && typeof slot.content === 'object') {
        Object.keys(slot.content).forEach((l) => {
          if (l && l !== '*' && l.length <= 6) langsSet.add(l.toUpperCase());
        });
      }
    }
    const langs = Array.from(langsSet);
    console.log(`${pc.bold('Languages:')}     ${langs.length > 0 ? langs.join(', ') : 'ES (default)'}`);

    // Embedded / referenced fonts
    if (metadata.fonts && Array.isArray(metadata.fonts) && metadata.fonts.length > 0) {
      console.log(`${pc.bold('Fonts:')}         ${metadata.fonts.map((f: any) => `${f.family} (${f.weight})`).join(', ')}`);
    }

    // Layers / slots overview
    console.log();
    console.log(pc.bold(`── Interactive Layers (${slots.length}) ─────────────────────────────────`));
    if (slots.length === 0) {
      console.log(pc.dim('  (No interactive layers)'));
    } else {
      slots.slice(0, 10).forEach((slot: any, idx: number) => {
        const type = slot.type || 'text';
        const name = slot.name ? ` "${slot.name}"` : '';
        const id = pc.dim(`[${slot.id}]`);
        const interactive = slot.isInteractive || slot.states || (Array.isArray(slot.interactions) && slot.interactions.length > 0)
          ? pc.magenta('✦ interactive')
          : '';
        console.log(`  ${pc.yellow((idx + 1).toString().padStart(2, ' '))}. ${type}${name} ${id} ${interactive}`);
      });
      if (slots.length > 10) {
        console.log(pc.dim(`  ... and ${slots.length - 10} more layers.`));
      }
    }

    // Cryptographic verification status
    console.log();
    console.log(pc.bold('── Security & Cryptographic Seal ───────────────────────────'));
    console.log(`${pc.bold('IDAT Hash (Pixels):')} ${imageHash ? imageHash.slice(0, 16) + '...' : pc.dim('not computed')}`);

    if (metadata.signature && metadata.key_version) {
      const isSigValid = await verifySignature(metadata);
      const isHashMatch = !metadata.image_hash || metadata.image_hash === imageHash;

      if (isSigValid && isHashMatch) {
        console.log(`${pc.bold('Signature:')}          ${pc.green('✔ VALID')} (ECDSA P-256, key ${metadata.key_version})`);
      } else if (!isHashMatch) {
        console.log(`${pc.bold('Signature:')}          ${pc.red('✖ TAMPERED (Image pixels do not match the seal)')}`);
      } else {
        console.log(`${pc.bold('Signature:')}          ${pc.red('✖ INVALID SIGNATURE (Metadata modified after signing)')}`);
      }
    } else {
      console.log(`${pc.bold('Signature:')}          ${pc.dim('○ Unsigned')}`);
    }
    console.log();
  } catch (err: any) {
    console.error(pc.red(`Error inspecting file: ${err.message}`));
    process.exit(1);
  }
}
