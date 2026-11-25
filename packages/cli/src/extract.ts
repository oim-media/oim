/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extractOIM } from '@oim-media/core';
import pc from 'picocolors';

export interface ExtractOptions {
  outImage?: string;
  outMeta?: string;
}

export async function extractCommand(filePath: string, options: ExtractOptions): Promise<void> {
  if (!existsSync(filePath)) {
    console.error(pc.red(`Error: File "${filePath}" not found.`));
    process.exit(1);
  }

  try {
    const fileBytes = readFileSync(filePath);
    const blob = new Blob([fileBytes], { type: 'image/png' });
    const { image, metadata } = await extractOIM(blob);

    if (!metadata) {
      console.error(pc.yellow('Warning: The file contains no OIM metadata to extract.'));
      process.exit(1);
    }

    const baseName = filePath.replace(/\.(oim|png)$/i, '');
    const outImgPath = options.outImage || `${baseName}.base.png`;
    const outMetaPath = options.outMeta || `${baseName}.meta.json`;

    // Save clean base image (without OIM chunks)
    const imgBuffer = Buffer.from(await image.arrayBuffer());
    writeFileSync(outImgPath, imgBuffer);
    console.log(pc.green(`✔ Base image extracted: ${outImgPath}`));

    // Save formatted metadata JSON
    writeFileSync(outMetaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(pc.green(`✔ Metadata extracted:   ${outMetaPath}`));
  } catch (err: any) {
    console.error(pc.red(`Error extracting components: ${err.message}`));
    process.exit(1);
  }
}
