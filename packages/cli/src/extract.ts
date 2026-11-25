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
    console.error(pc.red(`Error: No se encontró el archivo "${filePath}".`));
    process.exit(1);
  }

  try {
    const fileBytes = readFileSync(filePath);
    const blob = new Blob([fileBytes], { type: 'image/png' });
    const { image, metadata } = await extractOIM(blob);

    if (!metadata) {
      console.error(pc.yellow('Aviso: El archivo no contiene metadatos OIM para extraer.'));
      process.exit(1);
    }

    const baseName = filePath.replace(/\.(oim|png)$/i, '');
    const outImgPath = options.outImage || `${baseName}.base.png`;
    const outMetaPath = options.outMeta || `${baseName}.meta.json`;

    // Guardar imagen base limpia (sin chunks OIM)
    const imgBuffer = Buffer.from(await image.arrayBuffer());
    writeFileSync(outImgPath, imgBuffer);
    console.log(pc.green(`✔ Imagen base extraída: ${outImgPath}`));

    // Guardar JSON de metadatos formateado
    writeFileSync(outMetaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(pc.green(`✔ Metadatos extraídos:  ${outMetaPath}`));
  } catch (err: any) {
    console.error(pc.red(`Error al extraer componentes: ${err.message}`));
    process.exit(1);
  }
}
