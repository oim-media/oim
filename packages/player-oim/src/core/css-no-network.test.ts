/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The ways to request a resource from CSS that do not spell `url(`.
 *
 * `neutralizeExternalCssUrls` only rewrote `url(...)`. Measured, these three
 * went through untouched, and the `style` attributes that
 * `sanitizeHtml` keeps still use it:
 *
 *   @import "https://x"            a string, no url()
 *   image-set("https://x" 1x)      a string, no url()
 *   \75rl(https://x)               url, spelled with a CSS escape
 *
 * Patching each spelling is a race against the CSS grammar. So a value that
 * contains any of them is dropped whole: fail-closed, and none of them is
 * something the editor writes.
 */

import { describe, it, expect } from "vitest";
import { neutralizeExternalCssUrls, sanitizeHtml } from "./security";

const BS = String.fromCharCode(92);

const SIN_URL = [
  '@import "https://tercero.example/a.css";',
  'background-image:image-set("https://tercero.example/b.png" 1x)',
  'background-image:-webkit-image-set("https://tercero.example/b.png" 1x)',
  "background:" + BS + "75rl(https://tercero.example/c)",
  "background:u" + BS + "72l(https://tercero.example/c)",
];

describe("CSS de un .oim: tampoco sin escribir url(", () => {
  it.each(SIN_URL)("no deja rastro de la direccion: %s", (css) => {
    expect(neutralizeExternalCssUrls(css)).not.toContain("tercero.example");
  });

  it.each(SIN_URL)("tampoco dentro de un style de texto: %s", (css) => {
    const html = sanitizeHtml('<span style=\'color:red;' + css.replace(/'/g, '"') + '\'>hola</span>');
    expect(html).not.toContain("tercero.example");
    expect(html).toContain("hola");
  });

  it("el CSS normal del editor sigue intacto", () => {
    const css = "color:#f59e0b;font-weight:700;letter-spacing:0.05em";
    expect(neutralizeExternalCssUrls(css)).toBe(css);
  });
});
