/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// What the scene does to what a file asks it to paint: no request to the
// network, no script, no foreign CSS. Split from the player's security module.

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
          const clean = neutralizeExternalCssUrls(attr.value);
          if (clean !== attr.value) el.setAttribute(attr.name, clean);
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
