/**
 * Checks the canonical signature form documented in README.md against the
 * conformance vectors, by VERIFYING their real signatures with the published
 * public key.
 *
 * A digest written in prose rots. This reproduces it, and -more importantly-
 * proves the seven rules are the ones the signer actually used: if the rules
 * were wrong, the signature would not verify.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const VECTORS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vectors');

/** The v1 key shipped inside the reference player. */
const PUBLIC_JWK = {
  kty: 'EC',
  crv: 'P-256',
  x: '5Qavr4M_npVognquI5k5D9K8wcXBXM9Z0mZHjqyehAs',
  y: 'oh7rz5Q7SlZT_ms2buyOw0bPX77QsXimc0X92Ymj2_o',
};

/** Rule 3: integral floats become integers, the rest round to 6 decimals. */
function normalizeNumbers(value) {
  if (Array.isArray(value)) return value.map(normalizeNumbers);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = normalizeNumbers(value[key]);
    return out;
  }
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) {
    return Number(value.toFixed(6));
  }
  return value;
}

/** Rule 4: sort keys by Unicode code point, not by UTF-16 code unit. */
function sortByCodePoint(value) {
  if (Array.isArray(value)) return value.map(sortByCodePoint);
  if (value !== null && typeof value === 'object') {
    const out = {};
    const keys = Object.keys(value).sort((a, b) => {
      const ap = [...a], bp = [...b];
      for (let i = 0; i < Math.min(ap.length, bp.length); i++) {
        const d = ap[i].codePointAt(0) - bp[i].codePointAt(0);
        if (d !== 0) return d;
      }
      return ap.length - bp.length;
    });
    for (const key of keys) out[key] = sortByCodePoint(value[key]);
    return out;
  }
  return value;
}

const EXCLUDED = ['signature', 'key_version', 'timestamp', 'creator_user_id'];

/** The seven rules of README.md, in order. */
export function serializeCanonical(metadata) {
  const kept = {};
  for (const key of Object.keys(metadata)) {
    if (!EXCLUDED.includes(key)) kept[key] = metadata[key];
  }
  return Buffer.from(JSON.stringify(sortByCodePoint(normalizeNumbers(kept))), 'utf8');
}

/** SHA-256 of the concatenated IDAT payloads: the image seal. */
export function imageDataHash(png) {
  const digest = crypto.createHash('sha256');
  for (const { kind, payload } of pngChunks(png)) {
    if (kind === 'IDAT') digest.update(payload);
  }
  return digest.digest('hex');
}

function* pngChunks(png) {
  let at = 8;
  while (at + 8 <= png.length) {
    const length = png.readUInt32BE(at);
    yield { kind: png.subarray(at + 4, at + 8).toString('latin1'), payload: png.subarray(at + 8, at + 8 + length) };
    at += 12 + length;
  }
}

function inflate(buffer) {
  for (const fn of [zlib.inflateRawSync, zlib.inflateSync]) {
    try { return fn(buffer); } catch { /* try the next framing */ }
  }
  return null;
}

/** Reads the format chunk, tolerating every framing published so far. */
export function readMetadata(png) {
  for (const { kind, payload } of pngChunks(png)) {
    if (kind !== 'tEXt' && kind !== 'zTXt' && kind !== 'iTXt') continue;
    const nul = payload.indexOf(0);
    if (!/oim|ovm/i.test(payload.subarray(0, nul).toString('latin1'))) continue;
    const body = payload.subarray(kind === 'zTXt' ? nul + 2 : nul + 1);
    let text = inflate(body);
    if (!text) {
      const binary = Buffer.from(body.toString('latin1').replace(/\s/g, ''), 'base64');
      text = inflate(binary) ?? binary;
    }
    const decoded = text.toString('utf8');
    if (decoded.trimStart().startsWith('{')) return JSON.parse(decoded);
  }
  return null;
}

function verifySignature(canonical, signatureB64) {
  const key = crypto.createPublicKey({ key: PUBLIC_JWK, format: 'jwk' });
  const raw = Buffer.from(signatureB64, 'base64');
  if (raw.length !== 64) return false;
  return crypto.verify('sha256', canonical, { key, dsaEncoding: 'ieee-p1363' }, raw);
}

/**
 * Rules 3 (numbers) and 4 (key order) are NOT exercised by any signed vector,
 * and no vector from our pipeline ever can: the signer writes the chunk from
 * its own canonical bytes, so what is stored is already rounded and sorted.
 * Removing either rule leaves every signature valid. Rule 6 and the seal, by
 * contrast, are proven by real signatures since the 20-vector matrix.
 *
 * These cases pin rules 3 and 4 anyway. They are known answers, not
 * signatures: they catch a regression in this file, they do NOT prove the
 * signer agrees.
 */
const KNOWN_ANSWERS = [
  { rule: 'rule 4 · key order', input: { b: 1, a: 2 }, expected: '{"a":2,"b":1}' },
  { rule: 'rule 4 · nested and in arrays', input: { a: [{ z: 1, y: 2 }] }, expected: '{"a":[{"y":2,"z":1}]}' },
  { rule: 'rule 6 · unescaped UTF-8', input: { t: 'Zürich' }, expected: '{"t":"Zürich"}' },
  { rule: 'rule 3 · decimal to integer', input: { x: 2.0 }, expected: '{"x":2}' },
  { rule: 'rule 3 · rounding to 6', input: { x: 0.1234567 }, expected: '{"x":0.123457}' },
  { rule: 'rule 2 · root only', input: { slots: [{ timestamp: 1 }], timestamp: 2 }, expected: '{"slots":[{"timestamp":1}]}' },
];

let knownAnswerFailures = 0;
for (const { rule, input, expected } of KNOWN_ANSWERS) {
  const got = serializeCanonical(input).toString('utf8');
  if (got !== expected) {
    knownAnswerFailures++;
    console.log(`  ${rule}
      esperado ${expected}
      obtenido ${got}`);
  }
}
console.log(
  knownAnswerFailures === 0
    ? `Rules without a signed vector: ${KNOWN_ANSWERS.length} known-answer cases, all correct.
`
    : `Rules without a signed vector: ${knownAnswerFailures} incorrect case(s).
`,
);

let failures = knownAnswerFailures;
for (const file of fs.readdirSync(VECTORS).filter((f) => f.endsWith('.oim.png')).sort()) {
  const png = fs.readFileSync(path.join(VECTORS, file));
  const metadata = readMetadata(png);
  const name = file.replace('.oim.png', '');

  if (!metadata?.signature) {
    console.log(`  ${name.padEnd(22)} unsigned`);
    continue;
  }

  const canonical = serializeCanonical(metadata);
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');
  const valid = verifySignature(canonical, metadata.signature);

  // The seal is only meaningful once the signature covering it is valid.
  const expected = metadata.image_hash_alg === 'sha256-idat' ? metadata.image_hash : null;
  const sealed = expected ? (imageDataHash(png) === expected ? 'seal ok' : 'SEAL BROKEN') : 'unsealed';

  if (!valid || sealed === 'SEAL BROKEN') failures++;
  console.log(
    `  ${name.padEnd(22)} ${digest.slice(0, 8)}… ${String(canonical.length).padStart(5)} B · ` +
    `${valid ? 'signature ok' : 'SIGNATURE INVALID'} · ${sealed}`,
  );
}

console.log(
  failures === 0
    ? '\nThe seven README rules reproduce the signature of every vector.'
    : `\n${failures} vector(s) do not verify: the README and the signer have drifted.`,
);
process.exit(failures === 0 ? 0 : 1);
