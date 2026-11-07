#!/usr/bin/env node
// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Visual conformance: compares a renderer's PNGs against the web goldens.
// Usage: node parity.mjs <renders-dir> --renderer <name> [--out <diff-dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, compare } from './parity-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const names = (dir, suffix) =>
  fs.readdirSync(dir).filter((f) => f.endsWith(suffix)).map((f) => f.slice(0, -suffix.length)).sort();

const diffImage = (golden, mask) => {
  const rgba = new Uint8Array(golden.rgba.length);
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4;
    if (mask[p]) rgba.set([255, 0, 0, 255], i);
    else rgba.set([golden.rgba[i] * 0.3, golden.rgba[i + 1] * 0.3, golden.rgba[i + 2] * 0.3, 255], i);
  }
  return { width: golden.width, height: golden.height, rgba };
};

export const runParity = ({
  rendersDir,
  renderer,
  outDir,
  goldenDir = path.join(HERE, '..', 'vectors', 'golden'),
  vectorsDir = path.join(HERE, '..', 'vectors'),
}) => {
  const failures = [], lines = [];
  const vectors = names(vectorsDir, '.oim.png');
  const goldens = names(goldenDir, '.web.png');
  const exceptionsFile = path.join(goldenDir, 'exceptions.json');
  const exceptions = (fs.existsSync(exceptionsFile) ? JSON.parse(fs.readFileSync(exceptionsFile, 'utf8')) : {})[renderer] ?? {};

  for (const v of vectors) if (!goldens.includes(v)) failures.push(`${v}: no golden for this vector, regenerate the goldens`);
  for (const g of goldens) if (!vectors.includes(g)) failures.push(`${g}: orphan golden, no vector`);
  for (const e of Object.keys(exceptions)) if (!vectors.includes(e)) failures.push(`${e}: unknown vector in exceptions`);
  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  for (const name of goldens.filter((g) => vectors.includes(g))) {
    const renderPath = path.join(rendersDir, `${name}.png`);
    const excepted = name in exceptions;
    let verdict, detail = '';
    if (!fs.existsSync(renderPath)) {
      verdict = 'FAIL'; detail = 'missing render';
    } else {
      const golden = decodePng(fs.readFileSync(path.join(goldenDir, `${name}.web.png`)));
      let r;
      try {
        r = compare(golden, decodePng(fs.readFileSync(renderPath)));
      } catch (err) {
        r = { ok: false, reason: err.message, area: 1, largestBlob: 0 };
      }
      detail = r.reason ?? `area=${(r.area * 100).toFixed(3)}% blob=${r.largestBlob}px`;
      verdict = r.ok ? 'PASS' : 'FAIL';
      if (!r.ok && outDir && r.mask?.length) fs.writeFileSync(path.join(outDir, `${name}.diff.png`), encodePng(diffImage(golden, r.mask)));
    }
    if (excepted && verdict === 'PASS') failures.push(`${name}: passes, remove the exception for ${renderer}`);
    else if (excepted) verdict = 'EXCEPTED';
    else if (verdict === 'FAIL') failures.push(`${name}: ${detail}`);
    lines.push(`${name.padEnd(32)} ${verdict.padEnd(8)} ${detail}`);
  }
  return { failures, lines };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const rendersDir = args[0], renderer = flag('--renderer');
  if (!rendersDir || !renderer) {
    console.error('usage: parity.mjs <renders-dir> --renderer <name> [--out <diff-dir>]');
    process.exit(2);
  }
  const { failures, lines } = runParity({ rendersDir, renderer, outDir: flag('--out') });
  lines.forEach((l) => console.log(l));
  failures.forEach((f) => console.error(`✖ ${f}`));
  console.log(failures.length ? `\n${failures.length} failure(s)` : '\nvisual parity: OK');
  process.exit(failures.length ? 1 : 0);
}
