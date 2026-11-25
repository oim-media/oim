/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { imageDataHash, OimMetadataSchema } from '@oim-media/core';
import { oimEndpoint, OIM_PACKAGE_FIELDS } from '@oim-media/core/api';
import { documentSchema, isV2 } from '@oim-media/core/v2';
import pc from 'picocolors';
import { insertOimChunk } from './png.js';

export interface PackOptions {
  meta: string;
  output?: string;
  sign?: boolean;
  endpoint?: string;
  apiKey?: string;
}

export interface RemotePackageOptions {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Packages and signs an image + metadata remotely through the public
 * `POST /v1/oim/package` Enterprise endpoint using `X-API-Key`.
 */
export async function packageRemoteSigned(
  imageBytes: Uint8Array,
  imageFilename: string,
  metadata: Record<string, unknown>,
  options: RemotePackageOptions = {}
): Promise<Uint8Array> {
  const apiKey = (options.apiKey || process.env.OIM_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('API key required for --sign: pass --api-key <key> or set OIM_API_KEY (Enterprise plan).');
  }

  const endpoint = options.endpoint || oimEndpoint('package');
  const fetchFn = options.fetchImpl || fetch;

  const form = new FormData();
  form.append(
    OIM_PACKAGE_FIELDS.file,
    new Blob([imageBytes as BlobPart], { type: 'image/png' }),
    imageFilename
  );
  form.append(OIM_PACKAGE_FIELDS.metadata, JSON.stringify(metadata));

  const res = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error in packaging/signing service (${res.status}): ${errText}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

export async function packCommand(imagePath: string, options: PackOptions): Promise<void> {
  if (!existsSync(imagePath)) {
    console.error(pc.red(`Error: Base image "${imagePath}" not found.`));
    process.exit(1);
  }
  if (!options.meta || !existsSync(options.meta)) {
    console.error(pc.red(`Error: Provide a valid metadata JSON file with --meta <file.json>.`));
    process.exit(1);
  }

  try {
    const rawImage = readFileSync(imagePath);
    const rawMeta = JSON.parse(readFileSync(options.meta, 'utf-8')) as Record<string, unknown>;

    // 1. Validate metadata against the matching contract (2.0 or legacy 1.x)
    const parseResult = (isV2(rawMeta) ? documentSchema : OimMetadataSchema).safeParse(rawMeta);
    if (!parseResult.success) {
      console.warn(pc.yellow('⚠ Warning: JSON has properties outside the OIM schema:'));
      parseResult.error.issues.slice(0, 5).forEach((iss) => {
        console.warn(pc.dim(`  • ${iss.path.join('.') || 'root'}: ${iss.message}`));
      });
    }

    const outPath = options.output || imagePath.replace(/\.png$/i, '.oim.png');

    // 2. Remote signing via public Enterprise endpoint (POST /v1/oim/package)
    if (options.sign) {
      const endpoint = options.endpoint || oimEndpoint('package');
      console.log(pc.cyan(`Packaging and signing via ${endpoint}...`));

      const signedBytes = await packageRemoteSigned(rawImage, basename(imagePath), rawMeta, {
        apiKey: options.apiKey,
        endpoint,
      });

      writeFileSync(outPath, signedBytes);
      console.log(pc.green(`✔ Packaged and signed with success: ${outPath}`));
      return;
    }

    // 3. Local unsigned packaging
    const finalMeta: Record<string, unknown> = { ...rawMeta };
    const arrayBuffer = rawImage.buffer.slice(rawImage.byteOffset, rawImage.byteOffset + rawImage.byteLength);
    const computedHash = await imageDataHash(arrayBuffer);
    if (computedHash) {
      finalMeta.image_hash = computedHash;
      finalMeta.image_hash_alg = 'sha256-idat';
    }

    const packedBytes = await insertOimChunk(arrayBuffer, finalMeta);
    writeFileSync(outPath, Buffer.from(packedBytes));

    console.log(pc.green(`✔ Packaged (unsigned) with success: ${outPath}`));
  } catch (err: any) {
    console.error(pc.red(`Error packaging: ${err.message}`));
    process.exit(1);
  }
}
