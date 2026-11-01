/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An SVG layer requests nothing through `url(...)` in its attributes.
 *
 * `sanitizeHtml` filtered `style` and the `href`/`src` schemes, but not the
 * presentation attributes: `fill="url(https://x/a.svg#g)"` survived, and the
 * browser fetched it when the work opened. The backend now drops these before
 * signing (saneado.py, `pide_fuera_por_css`); this is the second line, for a
 * file that did not go through it.
 */

import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./security";

const BS = String.fromCharCode(92);

const PIDEN_FUERA = [
  '<svg><rect fill="url(https://tercero.example/a.svg#g)"></rect></svg>',
  "<svg><rect stroke=\"url('//tercero.example/a.svg#g')\"></rect></svg>",
  '<svg><g filter="url(http://tercero.example/f.svg#f)"></g></svg>',
  '<svg><g mask="url(https://tercero.example/m.svg#m)"></g></svg>',
  '<svg><g clip-path="url(https://tercero.example/c.svg#c)"></g></svg>',
  '<svg><rect fill="url(&#104;ttps://tercero.example/a.svg#g)"></rect></svg>',
  '<svg><rect fill="' + BS + '75rl(https://tercero.example/c)"></rect></svg>',
];

describe("an SVG from a .oim does not request anything via url() in its attributes", () => {
  it.each(PIDEN_FUERA)("no trace of the address remains: %s", (html) => {
    expect(sanitizeHtml(html)).not.toContain("tercero.example");
  });

  it("internal references stay: gradients, filters, masks", () => {
    const html = sanitizeHtml(
      '<svg><rect fill="url(#g)" filter="url(#sombra)" mask="url( #m )" clip-path="url(\'#c\')"></rect></svg>',
    );
    expect(html).toContain('fill="url(#g)"');
    expect(html).toContain('filter="url(#sombra)"');
    expect(html).toContain("mask=");
    expect(html).toContain("clip-path=");
  });

  it("only the guilty attribute is removed", () => {
    const html = sanitizeHtml('<svg><rect width="10" fill="url(https://tercero.example/a#g)"></rect></svg>');
    expect(html).toContain('width="10"');
    expect(html).not.toContain("fill=");
  });
});
