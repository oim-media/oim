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
  .description('Herramienta oficial de línea de comandos para el ecosistema OIM')
  .version('1.0.0');

program
  .command('inspect')
  .description('Inspecciona los metadatos interactivos, capas, fuentes y firma de un archivo OIM')
  .argument('<archivo>', 'Ruta al archivo .oim o .png')
  .action(async (file: string) => {
    await inspectCommand(file);
  });

program
  .command('verify')
  .description('Valida la integridad del archivo contra el esquema Zod y verifica la firma criptográfica')
  .argument('<archivo>', 'Ruta al archivo .oim o .png')
  .option('--json', 'Devuelve el resultado en formato JSON estructurado')
  .action(async (file: string, options: { json?: boolean }) => {
    await verifyCommand(file, options);
  });

program
  .command('extract')
  .description('Separa la imagen base limpia del JSON de metadatos interactivos')
  .argument('<archivo>', 'Ruta al archivo .oim o .png')
  .option('-i, --out-image <path>', 'Ruta de salida para la imagen PNG base')
  .option('-m, --out-meta <path>', 'Ruta de salida para el JSON de metadatos')
  .action(async (file: string, options: { outImage?: string; outMeta?: string }) => {
    await extractCommand(file, options);
  });

program
  .command('pack')
  .description('Empaqueta una imagen base PNG con metadatos interactivos en un archivo .oim.png')
  .argument('<imagen>', 'Ruta a la imagen base PNG')
  .requiredOption('-m, --meta <json>', 'Ruta al archivo de metadatos JSON')
  .option('-o, --output <path>', 'Ruta del archivo de salida empaquetado')
  .option('--sign', 'Empaqueta y firma vía POST /v1/oim/package (requiere clave API Enterprise)')
  .option('--api-key <key>', 'Clave API Enterprise para X-API-Key (o variable OIM_API_KEY)')
  .option('--endpoint <url>', 'URL del endpoint de empaquetado/firma')
  .action(async (image: string, options: any) => {
    await packCommand(image, options);
  });

program
  .command('upgrade')
  .description('Convierte un archivo OIM 1.x a 2.0 (queda sin firmar)')
  .argument('<archivo>', 'Ruta al archivo .oim.png')
  .option('-o, --output <path>', 'Ruta del archivo 2.0 de salida')
  .action(async (file: string, options: { output?: string }) => {
    await upgradeCommand(file, options);
  });

program.parse(process.argv);
