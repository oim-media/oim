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
    console.error(pc.red(`Error: No se encontró el archivo "${filePath}".`));
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

    console.log(`${pc.bold('Archivo:')}       ${filePath}`);
    console.log(`${pc.bold('Tamaño:')}        ${(fileBytes.length / 1024).toFixed(1)} KB`);

    if (!metadata) {
      console.log(pc.yellow('\n⚠ Este archivo no contiene metadatos interactivos OIM (imagen PNG estándar).'));
      return;
    }

    const version = metadata.version || metadata.oim_version || 'desconocida';
    const docId = metadata.oim_id || metadata.ovm_id || '(sin id)';
    const title = metadata.name || '(sin título)';
    const slots = metadata.slots || metadata.elements || [];

    console.log(`${pc.bold('Versión OIM:')}   ${pc.green(version)}`);
    console.log(`${pc.bold('Document ID:')}   ${docId}`);
    console.log(`${pc.bold('Título:')}        ${title}`);
    console.log(`${pc.bold('Reedición:')}     ${permissionOf(metadata)}`);

    // Idiomas detectados
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
    console.log(`${pc.bold('Idiomas:')}       ${langs.length > 0 ? langs.join(', ') : 'ES (predeterminado)'}`);

    // Tipografías
    if (metadata.fonts && Array.isArray(metadata.fonts) && metadata.fonts.length > 0) {
      console.log(`${pc.bold('Fuentes:')}       ${metadata.fonts.map((f: any) => `${f.family} (${f.weight})`).join(', ')}`);
    }

    // Análisis de Capas / Slots
    console.log();
    console.log(pc.bold(`── Capas Interactivas (${slots.length}) ─────────────────────────────────`));
    if (slots.length === 0) {
      console.log(pc.dim('  (Sin slots interactivos)'));
    } else {
      slots.slice(0, 10).forEach((slot: any, idx: number) => {
        const type = slot.type || 'text';
        const name = slot.name ? ` "${slot.name}"` : '';
        const id = pc.dim(`[${slot.id}]`);
        const interactive = slot.isInteractive || slot.states ? pc.magenta('✦ interactivo') : '';
        console.log(`  ${pc.yellow((idx + 1).toString().padStart(2, ' '))}. ${type}${name} ${id} ${interactive}`);
      });
      if (slots.length > 10) {
        console.log(pc.dim(`  ... y ${slots.length - 10} capas más.`));
      }
    }

    // Estado Criptográfico y Seguridad
    console.log();
    console.log(pc.bold('── Seguridad & Sello Criptográfico ─────────────────────────'));
    console.log(`${pc.bold('Hash IDAT (Píxeles):')} ${imageHash ? imageHash.slice(0, 16) + '...' : pc.dim('no computado')}`);

    if (metadata.signature && metadata.key_version) {
      const isSigValid = await verifySignature(metadata);
      const isHashMatch = !metadata.image_hash || metadata.image_hash === imageHash;

      if (isSigValid && isHashMatch) {
        console.log(`${pc.bold('Firma:')}              ${pc.green('✔ VÁLIDA')} (ECDSA P-256, clave ${metadata.key_version})`);
      } else if (!isHashMatch) {
        console.log(`${pc.bold('Firma:')}              ${pc.red('✖ ALTERADA (Los píxeles de la imagen no coinciden con el sello)')}`);
      } else {
        console.log(`${pc.bold('Firma:')}              ${pc.red('✖ FIRMA INVÁLIDA (Metadatos manipulados)')}`);
      }
    } else {
      console.log(`${pc.bold('Firma:')}              ${pc.dim('○ Sin firma criptográfica')}`);
    }
    console.log();
  } catch (err: any) {
    console.error(pc.red(`Error al inspeccionar el archivo: ${err.message}`));
    process.exit(1);
  }
}
