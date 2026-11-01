/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { embeddedKey, effectiveNotAfter, keysEndpoint, signatureIsWithinKeyWindow, keyExpiredAt, type PlayerKey } from './keys.js';
import { serializeCanonical } from '../../../core/src/canonical.js';

const _cachedKeys: Record<string, any> = {};
let _keysFetchPromise: Promise<void> | null = null;
let _hasAttemptedIdbLookup = false;
let _idbLookupPromise: Promise<void> | null = null;

function getCachedKeysIDB(): Promise<any[]> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      return resolve([]);
    }
    try {
      const request = indexedDB.open("oim-player-keys", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("keys")) {
          db.createObjectStore("keys", { keyPath: "kid" });
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("keys")) {
          resolve([]);
          db.close();
          return;
        }
        const transaction = db.transaction("keys", "readonly");
        const store = transaction.objectStore("keys");
        const req = store.getAll();
        req.onsuccess = () => {
          resolve(req.result || []);
          db.close();
        };
        req.onerror = () => {
          resolve([]);
          db.close();
        };
      };
      request.onerror = () => {
        resolve([]);
      };
    } catch (_) {
      resolve([]);
    }
  });
}

function saveKeysIDB(keys: any[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      return resolve();
    }
    try {
      const request = indexedDB.open("oim-player-keys", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("keys")) {
          db.createObjectStore("keys", { keyPath: "kid" });
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("keys")) {
          resolve();
          db.close();
          return;
        }
        const transaction = db.transaction("keys", "readwrite");
        const store = transaction.objectStore("keys");
        keys.forEach((key) => {
          store.put(key);
        });
        transaction.oncomplete = () => {
          resolve();
          db.close();
        };
        transaction.onerror = () => {
          resolve();
          db.close();
        };
      };
      request.onerror = () => {
        resolve();
      };
    } catch (_) {
      resolve();
    }
  });
}

export async function getPublicKey(kid: string): Promise<any> {
  // Always a plain JWK, never the PlayerKey wrapper: callers feed this straight
  // into crypto.subtle.importKey, and a two-shaped return is a trap for them.
  const local = embeddedKey(kid);
  if (local) return local.jwk;

  if (_cachedKeys[kid]) return _cachedKeys[kid];

  if (!_hasAttemptedIdbLookup) {
    if (!_idbLookupPromise) {
      _idbLookupPromise = getCachedKeysIDB().then((keys) => {
        keys.forEach((k) => {
          _cachedKeys[k.kid] = k;
        });
        _hasAttemptedIdbLookup = true;
      });
    }
    await _idbLookupPromise;
    if (_cachedKeys[kid]) return _cachedKeys[kid];
  }

  await fetchServerKeys();

  return _cachedKeys[kid];
}

function fetchServerKeys(): Promise<void> {
  if (!_keysFetchPromise) {
    _keysFetchPromise = (async function() {
      try {
        const url = keysEndpoint();
        const resp = await fetch(url).catch(() => null);
        let data: any = null;
        if (resp && resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.indexOf('application/json') !== -1) {
            try {
              data = await resp.json();
            } catch (_) {}
          }
        }

        if (data && Array.isArray(data.keys)) {
          for (let i = 0; i < data.keys.length; i++) {
            const k = data.keys[i];
            _cachedKeys[k.kid] = k;
          }
          await saveKeysIDB(data.keys);
        }
      } catch (err) {
        console.warn('[OimPlayer::Security] Failed to fetch public keys from server:', err);
      }
    })();
  }

  return _keysFetchPromise;
}

/** Returns the key published by the server for this kid, bypassing the pinned fallbacks. */
export async function getServerPublicKey(kid: string): Promise<any | null> {
  await fetchServerKeys();
  return _cachedKeys[kid] || null;
}

export { serializeCanonical };

export async function verifyMetadataSignature(metadata: any, origin?: string): Promise<boolean> {
  if (!metadata || typeof metadata !== 'object') return false;
  if (!metadata.signature || !metadata.key_version) {
    console.warn('[OimPlayer::Security] Metadata is not signed. Skipping signature verification (Legacy mode).');
    return true;
  }
  
  try {
    const keyJwk = await getPublicKey(metadata.key_version);
    if (!keyJwk) {
      console.error('[OimPlayer::Security] Public key not found for version:', metadata.key_version);
      return false;
    }

    const canonicalBytes = serializeCanonical(metadata);

    const sigBinary = atob(metadata.signature);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i);
    }

    const verifyWithJwk = async (jwk: any, bytes: Uint8Array): Promise<boolean> => {
      const pubKey = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
      );
      return crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        pubKey,
        sigBytes,
        bytes as Uint8Array<ArrayBuffer> // never a SharedArrayBuffer here; TS 6 types require saying so
      );
    };

    let isValid = await verifyWithJwk(keyJwk, canonicalBytes);

    // Backward-compatibility fallback: files published before the
    // creator_user_id exclusion change were signed keeping that field at the root.
    if (!isValid && metadata.creator_user_id) {
      const legacyCleaned: Record<string, any> = {};
      const legacyKeys = Object.keys(metadata).filter(function (k) {
        return k !== 'signature' && k !== 'key_version' && k !== 'timestamp';
      }).sort();
      function legacySortKeys(obj: any): any {
        if (Array.isArray(obj)) return obj.map(legacySortKeys);
        if (obj !== null && typeof obj === 'object') {
          const sorted: Record<string, any> = {};
          const keys = Object.keys(obj).sort();
          for (let i = 0; i < keys.length; i++) {
            sorted[keys[i]] = legacySortKeys(obj[keys[i]]);
          }
          return sorted;
        }
        return obj;
      }
      for (let i = 0; i < legacyKeys.length; i++) {
        legacyCleaned[legacyKeys[i]] = legacySortKeys(metadata[legacyKeys[i]]);
      }
      const legacyBytes = new TextEncoder().encode(JSON.stringify(legacyCleaned));
      isValid = await verifyWithJwk(keyJwk, legacyBytes);
    }

    // The pinned fallback key may be stale (e.g. the server rotated its keypair
    // under the same kid). Before declaring the file tampered, retry with the
    // key currently published by the server.
    if (!isValid) {
      try {
        const serverJwk = await getServerPublicKey(metadata.key_version);
        if (serverJwk && (serverJwk.x !== keyJwk.x || serverJwk.y !== keyJwk.y)) {
          console.warn('[OimPlayer::Security] Pinned key failed; retrying with the key published by the server for kid:', metadata.key_version);
          isValid = await verifyWithJwk(serverJwk, canonicalBytes);
        }
      } catch (_) { /* network failure — keep pinned-key result */ }
    }

    if (isValid) {
      // Both sources count: the key we ship and the one the server published.
      const not_after = effectiveNotAfter(metadata.key_version, keyJwk);
      const key = { kid: metadata.key_version, jwk: keyJwk, not_after };
      if (!signatureIsWithinKeyWindow(key, metadata.signed_at)) {
        console.error('[OimPlayer::Security] Signature made after this key was retired.');
        return false;
      }
    }

    if (!isValid) {
      console.error('[OimPlayer::Security] Cryptographic signature VERIFICATION FAILED. Metadata was tampered with!');
    }
    return isValid;
  } catch (err) {
    console.error('[OimPlayer::Security] Error verifying signature:', err);
    return false;
  }
}

import { permissionOf, signatureStamp } from '../../../core/src/reeditPermission.js';
// The format limit, not a copied literal: `limits.js` does not pull in zod.
import { MAX_SLOTS } from '../../../core/src/limits.js';

/**
 * What the player can say about a file, from strongest to weakest claim.
 * `image_mismatch` and `invalid_signature` mean the file was altered after
 * OIM signed it: its image or its metadata. An altered file is not shown.
 */
export type SecurityStatus =
  | 'verified'
  | 'verified_authorless'
  | 'image_unsealed'
  | 'unsigned'
  | 'expired_key'
  | 'invalid_signature'
  | 'image_mismatch'
  | 'no_metadata'
  | 'corrupt';

export interface VerdictInput {
  isSigned: boolean;
  isSigValid: boolean;
  keyExpired?: boolean;
  metadata: any;
  /** SHA-256 of the file's IDAT payloads (core `imageDataHash`), or null. */
  imageHash: string | null;
}

/**
 * The single place that decides a file's security status. Both load paths
 * (worker and main thread) call it; they used to carry their own copies and
 * the worker's never said "signed without authorship".
 *
 * The signature covers `image_hash`, so once the signature is valid the seal
 * can be trusted; what is checked here is that the image actually shipped in
 * the file is the one that was sealed. Files signed before the seal existed
 * carry no `image_hash` and get the weaker `image_unsealed`.
 */
export function securityVerdict(input: VerdictInput): SecurityStatus {
  if (!input.isSigned) return 'unsigned';
  if (!input.isSigValid) return 'invalid_signature';

  // Authentic but signed with a key this player no longer trusts. Checked
  // after tampering on purpose: an altered file is refused either way.
  if (input.keyExpired) return 'expired_key';

  // Only seals made by the current scheme are enforced. Previously a client
  // sent its own `image_hash` and the backend signed it unchecked (one sample
  // carries the SHA-256 of empty input), so a legacy hash proves nothing and
  // must not get a legitimate file refused.
  const meta = input.metadata || {};
  const seal = meta.image_hash_alg === IMAGE_HASH_ALG && typeof meta.image_hash === 'string' ? meta.image_hash : '';
  if (!seal) return 'image_unsealed';
  if (!input.imageHash || seal.toLowerCase() !== input.imageHash.toLowerCase()) return 'image_mismatch';

  return signatureStamp(permissionOf(input.metadata));
}

/** Whether the key that signed this file is past its verify_until, by the device clock. */
export async function keyExpiredForFile(metadata: any, now: number = Date.now()): Promise<boolean> {
  const kid = metadata && metadata.key_version;
  if (!kid) return false;
  if (embeddedKey(kid)) return keyExpiredAt(kid, null, now);
  const serverJwk = await getServerPublicKey(kid);
  return keyExpiredAt(kid, serverJwk, now);
}

/** The seal scheme the backend writes in `image_hash_alg`: SHA-256 of the IDAT payloads. */
export const IMAGE_HASH_ALG = 'sha256-idat';

/** Altered files are refused outright: neither their image nor their layers are shown. */
export function isRefused(status: SecurityStatus): boolean {
  return status === 'image_mismatch' || status === 'invalid_signature';
}

/** Marker in the error an altered file raises, so hosts can tell it from a broken one. */
export const ALTERED_FILE_ERROR = 'OIM_ALTERED';

export function validateOimMetadata(json: any): string[] {
  const errors: string[] = [];
  function fail(msg: string) { errors.push(msg); }
  function okStr(v: any, max?: number) { return typeof v === 'string' && v.length <= (max || 10000000); }
  function okNum(v: any) { return typeof v === 'number' && isFinite(v); }

  if (typeof json !== 'object' || json === null) { fail('metadata must be object'); return errors; }

  const slots = json.slots || json.elements || [];
  if (!Array.isArray(slots)) { fail('slots must be array'); return errors; }
  if (slots.length > MAX_SLOTS) { fail(`max ${MAX_SLOTS} slots`); }

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (typeof s !== 'object' || s === null) { fail('slot[' + i + '] must be object'); continue; }
    // id is validated only when present — old files may omit it
    if (s.id !== undefined && s.id !== null && (typeof s.id !== 'string' || s.id.length > 128)) {
      fail('slot[' + i + '].id invalid');
    }

    const content = s.content;
    if (content !== undefined) {
      if (typeof content !== 'object' || content === null) {
        fail('slot[' + i + '].content must be object');
      } else {
        const keys = Object.keys(content);
        for (let k = 0; k < keys.length; k++) {
          const val = content[keys[k]];
          // Accept strings, numbers, booleans, arrays (multilingual list), and nested objects
          // (multilingual maps like { en: '...', es: '...' }). Only reject non-finite numbers.
          if (typeof val === 'string') {
            if (val.length > 10000000) fail('slot[' + i + '].content.' + keys[k] + ' too long');
          } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            // Nested language map — validate each leaf string
            const langKeys = Object.keys(val);
            for (let lk = 0; lk < langKeys.length; lk++) {
              if (!okStr(val[langKeys[lk]])) fail('slot[' + i + '].content.' + keys[k] + '.' + langKeys[lk] + ' invalid');
            }
          }
          // Arrays, numbers, booleans, null — accepted without deep validation
        }
      }
    }

    if (s.style) {
      if (typeof s.style !== 'object') fail('slot[' + i + '].style must be object');
      // `fillColor` and not `color`: contract 1.5.0 removed `color`, and a
      // removed field is no longer painted, so there is nothing to validate in it.
      else if (s.style.fillColor && (typeof s.style.fillColor !== 'string' || s.style.fillColor.length > 64)) fail('slot[' + i + '].style.fillColor invalid');
    }

    if (s.position && (!Array.isArray(s.position) || s.position.length < 2 || !okNum(s.position[0]) || !okNum(s.position[1]))) {
      fail('slot[' + i + '].position invalid');
    }
  }

  return errors;
}

/**
 * Schemes allowed in `href` and `src`.
 *
 * ALLOWLIST of schemes, not a search for "javascript:". A denylist over that
 * string is bypassed with uppercase letters, spaces in the middle, line breaks
 * or entities -`&#106;avascript:`-, because the browser normalizes all of that
 * AFTER the filter has looked. Asking "is it one of the ones I allow?" those
 * variants never get to exist.
 */
function isSafeScheme(value: string, fragmentOnly: boolean): boolean {
  // Browsers IGNORE tabs, line breaks and carriage returns inside a URL before
  // resolving it, so `java\nscript:alert(1)` does run. If the raw value is
  // checked, that break makes it look like it has no scheme at all, and it
  // slips through as a relative path. You must normalize BEFORE deciding:
  // I check it with a test and it passed.
  //
  // Filtering is done by CODE and not with a range written in the regular
  // expression: a control-character range in the source gets turned into the
  // REAL characters by the tools that touch the file, and then the code carries
  // an invisible null inside. It happened while writing this, and again in the
  // project-name sanitizer.
  const raw = value || '';
  let v = '';
  for (let k = 0; k < raw.length; k++) {
    if (raw.charCodeAt(k) >= 32) v += raw.charAt(k);
  }
  v = v.trim();

  // Internal reference to the document itself: `<use href="#id">`.
  if (v.charAt(0) === '#') return true;

  // `<use>` can only point inside the document. An external reference pulls
  // content from another site; modern browsers block it by same-origin policy,
  // but it is still a request the file should not trigger, and closing it here
  // costs nothing.
  if (fragmentOnly) return false;

  // No scheme: relative path.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return true;

  return /^https?:/i.test(v) || /^data:image\//i.test(v);
}

export function sanitizeHtml(htmlStr: string): string {
  // There is NO shortcut for SVG.
  //
  // There used to be an `if (htmlStr.startsWith('<svg')) return htmlStr;` that
  // SKIPPED ALL the sanitizing below. Since any SVG starts with `<svg`, the
  // filter never ran for vector content: an authored `<svg onload="...">`
  // passed through intact to the live document, where event attributes DO fire
  // -`<script>` tags do not, because they come out inert from DOMParser, but an
  // `onload` or an `onerror` is enough-. And the .oim travels to third parties,
  // so it ran in the origin of whoever opened it.
  //
  // The shortcut existed for a real reason: the allowlist was so short that it
  // mangled legitimate SVG. The fix is for the list to cover what it has to.
  // If some vector content stops showing, it is added to the list; the door is
  // not reopened.
  if (typeof DOMParser === 'undefined') return htmlStr;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');

    const allowedTags = [
      // Structure and shapes
      'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
      'path', 'circle', 'rect', 'polygon', 'polyline', 'ellipse', 'line',
      // Paint
      'lineargradient', 'radialgradient', 'stop', 'pattern', 'image',
      // Clipping, masks and filters: the player generates them for its own
      // shapes, and authored vector art brings them built in.
      'clippath', 'mask', 'filter',
      'fegaussianblur', 'fecolormatrix', 'fecomponenttransfer',
      'fefunca', 'fefuncr', 'fefuncg', 'fefuncb',
      'feblend', 'feoffset', 'femerge', 'femergenode', 'feflood', 'fecomposite',
      // Text inside the SVG
      'text', 'tspan',
      // HTML of the rich-text slots
      'span', 'div', 'br', 'p', 'a', 'b', 'i', 'strong', 'em', 'img'
    ];

    const allowedAttrs = [
      // General
      'class', 'style', 'id', 'lang', 'aria-hidden', 'part', 'transform',
      // Geometry
      'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'dx', 'dy',
      'x1', 'y1', 'x2', 'y2', 'fx', 'fy', 'width', 'height', 'points',
      'viewbox', 'preserveaspectratio', 'vector-effect',
      // Paint
      'fill', 'stroke', 'fill-rule', 'clip-rule', 'opacity',
      'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap',
      'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset',
      'stroke-miterlimit', 'offset', 'stop-color', 'stop-opacity',
      'gradientunits', 'gradienttransform', 'spreadmethod',
      'patternunits', 'patterncontentunits', 'patterntransform',
      // Clipping, masks and filters
      'clip-path', 'clippathunits', 'mask', 'maskunits', 'maskcontentunits',
      'filter', 'filterunits', 'primitiveunits', 'stddeviation', 'result',
      'in', 'in2', 'mode', 'type', 'values', 'tablevalues',
      'flood-color', 'flood-opacity', 'operator',
      // Text
      'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
      'dominant-baseline', 'letter-spacing', 'word-spacing',
      // Links and resources: the value is filtered by `isSafeScheme`
      'href', 'src', 'target', 'rel', 'alt',
      // Player-specific
      'data-slot-id', 'allow-lottie', 'show-controls', 'crossorigin'
    ];
    
    const all = doc.body.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      const tag = el.tagName.toLowerCase();
      if (allowedTags.indexOf(tag) === -1) {
        el.parentNode?.removeChild(el);
        continue;
      }
      const attrs = el.attributes;
      for (let j = attrs.length - 1; j >= 0; j--) {
        const attr = attrs[j];
        const name = attr.name.toLowerCase();
        if (name.indexOf('on') === 0 || allowedAttrs.indexOf(name) === -1) {
          el.removeAttribute(attr.name);
          continue;
        }
        // `href` by scheme allowlist and not by searching for "javascript:", which
        // is what it was: that comparison is bypassed by `JaVaScRiPt:`, a line
        // break in the middle, or `&#106;avascript:`, because the browser
        // normalizes after we look.
        // In `<use>` and `<image>` the href BRINGS content; in `<a>` it only
        // navigates. That is why the former are restricted to the document itself.
        if (name === 'href' && !isSafeScheme(attr.value, tag === 'use' || tag === 'image')) {
          el.removeAttribute(attr.name);
        }
        if (name === 'style') {
          const limpio = neutralizeExternalCssUrls(attr.value);
          if (limpio !== attr.value) el.setAttribute(attr.name, limpio);
        } else if (name !== 'href' && name !== 'src' && requestsOutsideByCss(attr.value)) {
          // `fill`, `stroke`, `filter`, `mask`, `clip-path`...: not URLs, but a
          // `url(https://...)` in them is a request when the work opens. Twin
          // of `pide_fuera_por_css` in the backend's `saneado.py`.
          el.removeAttribute(attr.name);
          continue;
        }
        if (name === 'src') {
          const val = attr.value.trim();
          // Only `data:`. External URLs were removed from the player: a .oim is
          // shared between users, and a request to a third party when opening it
          // reveals the IP and browser of whoever is looking.
          const isSafe = isSafeImageDataUri(val);
          if (!isSafe) {
            el.removeAttribute(attr.name);
          }
        }
      }
    }
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('[OimPlayer] HTML sanitization failed:', e);
    return '';
  }
}

/**
 * Sandbox: a .oim does not talk to anyone when opened. An image travels inside
 * the file (`data:image/...`) or is a `blob:` the player made from it; any
 * network URL -ours included, localhost included- would reveal who is looking.
 */
export function isSandboxImageSrc(src: string): boolean {
  const s = (src || '').trim().toLowerCase();
  return s.indexOf('data:image/') === 0 || s.indexOf('blob:') === 0;
}

/**
 * Replaces every CSS `url(...)` that points outside the document with `none`.
 * Kept: `url(#id)` (filters, masks, gradients the player generates) and
 * `url(data:...)`. Applied to author CSS (`custom_keyframes`) and to the
 * `style` attributes `sanitizeHtml` keeps: both reached the network before.
 */
export function neutralizeExternalCssUrls(css: string): string {
  if (typeof css !== 'string') return css;
  // Three ways to request a resource that do not spell `url(`: `@import`
  // with a string, `image-set()` with a string, and a CSS escape that
  // rebuilds `url`. Patching each spelling is a race against the grammar, so
  // any of them drops the whole value. The editor writes none of them.
  if (css.indexOf(String.fromCharCode(92)) !== -1 || /@import|image-set\s*\(/i.test(css)) return '';
  if (css.indexOf('(') === -1) return css;
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, function (whole, _q, target) {
    const t = String(target).trim().toLowerCase();
    return t.indexOf('#') === 0 || t.indexOf('data:') === 0 ? whole : 'none';
  });
}

/**
 * Whether an attribute value would make the browser request a resource
 * through CSS: a `url(...)` that is not `#id` or `data:`, or the ways to
 * request without spelling `url(` (`image-set(`, `@import`, a CSS escape).
 * The value arrives entity-decoded, so `&#104;ttps` reads as `https`.
 */
export function requestsOutsideByCss(value: string): boolean {
  const v = typeof value === 'string' ? value : '';
  if (v.indexOf(String.fromCharCode(92)) !== -1 || /image-set\s*\(|@import/i.test(v)) return true;
  const re = /url\(\s*['"]?\s*([^'")\s]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v)) !== null) {
    const target = m[1].trim().toLowerCase();
    if (target.indexOf('#') !== 0 && target.indexOf('data:') !== 0) return true;
  }
  return false;
}

export function isSafeImageDataUri(str: string): boolean {
  const s = (str || '').trim();
  if (s.indexOf('data:image/') !== 0) return false;
  const commaIdx = s.indexOf(',');
  if (commaIdx === -1) return false;
  const meta = s.substring(0, commaIdx).toLowerCase();
  if (meta.indexOf(';base64') === -1) return false;
  const mime = meta.substring(5, meta.indexOf(';'));
  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  return allowedMimes.indexOf(mime) !== -1;
}

export function sanitizeFontFamily(name: string): string {
  if (!name || typeof name !== 'string') return 'Inter, sans-serif';
  return name.replace(/[^a-zA-Z0-9 ,\-\.'\'"]/g, '').trim().slice(0, 128) || 'Inter, sans-serif';
}
