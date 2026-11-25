/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, existsSync } from 'node:fs';
import { extractOIM, OimMetadataSchema } from '@oim-media/core';
import { documentSchema, isV2 } from '@oim-media/core/v2';
import pc from 'picocolors';
import { verifySignature } from './crypto.js';

export interface VerifyOptions {
  json?: boolean;
}

/** The checks of `oim verify` on a file's bytes: a 2.0 document against the 2.0 schema, 1.x against 1.x. */
export async function verifyBytes(fileBytes: Uint8Array): Promise<{ metadata: any; imageHash: string | null; issues: string[] }> {
  const blob = new Blob([fileBytes as BlobPart], { type: 'image/png' });
  const { metadata, imageHash } = await extractOIM(blob);
  const issues: string[] = [];
  if (!metadata) return { metadata, imageHash, issues: ['No contiene chunk de metadatos OIM'] };

  const parseResult = (isV2(metadata) ? documentSchema : OimMetadataSchema).safeParse(metadata);
  if (!parseResult.success) {
    parseResult.error.issues.forEach((iss) => {
      issues.push(`Esquema: ${iss.path.join('.') || 'root'}: ${iss.message}`);
    });
  }
  if (metadata.image_hash && metadata.image_hash !== imageHash) {
    issues.push(`Píxeles alterados: el hash de la imagen (${imageHash}) no coincide con el sello (${metadata.image_hash})`);
  }
  if (metadata.signature && metadata.key_version && !(await verifySignature(metadata))) {
    issues.push('Firma criptográfica inválida: los metadatos fueron alterados tras la firma');
  }
  return { metadata, imageHash, issues };
}

export async function verifyCommand(filePath: string, options: VerifyOptions): Promise<void> {
  if (!existsSync(filePath)) {
    if (options.json) {
      console.log(JSON.stringify({ valid: false, error: 'File not found', path: filePath }));
    } else {
      console.error(pc.red(`Error: No se encontró el archivo "${filePath}".`));
    }
    process.exit(1);
  }

  try {
    const { metadata, imageHash, issues } = await verifyBytes(readFileSync(filePath));

    const isValid = issues.length === 0;

    if (options.json) {
      console.log(JSON.stringify({
        valid: isValid,
        path: filePath,
        hasMetadata: !!metadata,
        isSigned: !!(metadata && metadata.signature),
        imageHash,
        issues,
      }, null, 2));
    } else {
      if (isValid) {
        console.log(pc.green(`✔ ${filePath} es un archivo OIM íntegro y válido.`));
      } else {
        console.error(pc.red(`✖ Falló la verificación de ${filePath}:`));
        issues.forEach((iss) => {
          console.error(pc.yellow(`  • ${iss}`));
        });
      }
    }

    if (!isValid) {
      process.exit(1);
    }
  } catch (err: any) {
    if (options.json) {
      console.log(JSON.stringify({ valid: false, error: err.message, path: filePath }));
    } else {
      console.error(pc.red(`Error durante la verificación: ${err.message}`));
    }
    process.exit(1);
  }
}
