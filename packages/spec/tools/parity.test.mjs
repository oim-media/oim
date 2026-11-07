// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodePng, decodePng } from './parity-core.mjs';
import { runParity } from './parity.mjs';

const white = () => ({ width: 40, height: 40, rgba: new Uint8Array(40 * 40 * 4).fill(255) });
const black = () => ({ width: 40, height: 40, rgba: new Uint8Array(40 * 40 * 4).map((_, i) => (i % 4 === 3 ? 255 : 0)) });

// vectors a, b; goldens a, b (white); renders as given.
const setup = ({ renders = { a: white(), b: white() }, exceptions = {}, vectors = ['a', 'b'], goldens = ['a', 'b'] } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
  const dirs = Object.fromEntries(['vectors', 'golden', 'renders', 'out'].map((d) => [d, path.join(root, d)]));
  Object.values(dirs).forEach((d) => fs.mkdirSync(d));
  vectors.forEach((v) => fs.writeFileSync(path.join(dirs.vectors, `${v}.oim.png`), ''));
  goldens.forEach((g) => fs.writeFileSync(path.join(dirs.golden, `${g}.web.png`), encodePng(white())));
  fs.writeFileSync(path.join(dirs.golden, 'exceptions.json'), JSON.stringify(exceptions));
  Object.entries(renders).forEach(([n, im]) => fs.writeFileSync(path.join(dirs.renders, `${n}.png`), encodePng(im)));
  const r = runParity({ rendersDir: dirs.renders, renderer: 'flutter', outDir: dirs.out, goldenDir: dirs.golden, vectorsDir: dirs.vectors });
  return { ...r, out: dirs.out };
};
const why = (r) => r.failures.join('\n');

test('all equal passes', () => assert.deepEqual(setup().failures, []));

test('missing render fails', () => assert.match(why(setup({ renders: { a: white() } })), /b: missing render/));

test('orphan golden fails', () => assert.match(why(setup({ vectors: ['a'], renders: { a: white() } })), /b: orphan golden/));

test('vector without golden fails', () => assert.match(why(setup({ goldens: ['a'] })), /b: no golden for/));

test('mismatch fails and writes a diff png', () => {
  const r = setup({ renders: { a: white(), b: black() } });
  assert.match(why(r), /^b: /);
  assert.equal(decodePng(fs.readFileSync(path.join(r.out, 'b.diff.png'))).width, 40);
});

test('excepted mismatch does not fail', () => {
  const exceptions = { flutter: { b: { reason: 'x', since: '2026-11-07' } } };
  assert.deepEqual(setup({ renders: { a: white(), b: black() }, exceptions }).failures, []);
});

test('exception of another renderer does not apply', () => {
  const exceptions = { web: { b: { reason: 'x', since: '2026-11-07' } } };
  assert.equal(setup({ renders: { a: white(), b: black() }, exceptions }).failures.length, 1);
});

test('excepted vector that passes fails', () => {
  const exceptions = { flutter: { b: { reason: 'x', since: '2026-11-07' } } };
  assert.match(why(setup({ exceptions })), /b: passes, remove the exception/);
});

test('unknown vector in exceptions fails', () => {
  const exceptions = { flutter: { zz: { reason: 'x', since: '2026-11-07' } } };
  assert.match(why(setup({ exceptions })), /zz: unknown vector in exceptions/);
});

test('excepted vector with a missing render still fails', () =>
  assert.match(why(setup({ renders: { a: white() }, exceptions: { flutter: { b: 'known' } } })), /b: missing render/));

test('excepted vector with a size mismatch still fails', () => {
  const small = { width: 20, height: 20, rgba: new Uint8Array(20 * 20 * 4).fill(255) };
  assert.match(why(setup({ renders: { a: white(), b: small }, exceptions: { flutter: { b: 'known' } } })), /^b: /m);
});

test('no vectors at all fails', () => assert.match(why(setup({ vectors: [], goldens: [], renders: {} })), /no vectors/));
