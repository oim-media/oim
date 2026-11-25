/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extractOIM } from '@oim-media/core';
import { documentSchema, upgrade } from '@oim-media/core/v2';
import pc from 'picocolors';
import { insertOimChunk } from './png.js';

// 1.x signing fields (the backend stamps `timestamp` on signing too): they sign the old document, so they cannot travel in the new one.
const SIGNING_KEYS = ['id', 'signature', 'key_version', 'signed_at', 'image_hash', 'image_hash_alg', 'timestamp'];

/** Rewrites a 1.x .oim.png as an unsigned 2.0 one over the same image; a 2.0 file comes back as is. */
export async function upgradeOimPng(png: Uint8Array): Promise<{ bytes: Uint8Array; from: string; to: string }> {
  const { metadata } = await extractOIM(new Blob([png as BlobPart], { type: 'image/png' }));
  if (!metadata) throw new Error('the file carries no OIM metadata');
  // Early 1.x files declare `oim: "true"` instead of a version.
  const from = /^\d/.test(String(metadata.oim)) ? String(metadata.oim) : '1.x';
  if (from.startsWith('2.')) return { bytes: png, from, to: from };

  const doc: Record<string, unknown> = { ...upgrade(metadata).document };
  for (const key of SIGNING_KEYS) delete doc[key];
  const document = documentSchema.parse(doc);
  const buffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  return { bytes: await insertOimChunk(buffer, document), from, to: String(document.oim) };
}

export async function upgradeCommand(filePath: string, options: { output?: string }): Promise<void> {
  if (!existsSync(filePath)) {
    console.error(pc.red(`Error: file not found "${filePath}".`));
    process.exit(1);
  }
  try {
    const { bytes, from, to } = await upgradeOimPng(new Uint8Array(readFileSync(filePath)));
    if (from === to) {
      console.log(pc.green(`✔ Already ${to}: nothing to do.`));
      return;
    }
    const output = options.output || filePath.replace(/(\.oim)?\.png$/i, '.v2.oim.png');
    writeFileSync(output, bytes);
    console.log(pc.green(`✔ ${from} → ${to}: ${output}`));
    console.log(pc.yellow('The file is unsigned now: sign it again (oim pack --sign) or re-export it from the editor.'));
  } catch (err: any) {
    console.error(pc.red(`Error: ${err.message}`));
    process.exit(1);
  }
}
