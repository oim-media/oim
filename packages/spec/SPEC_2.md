<!--
Copyright (c) 2026 Xue Studios LLC
SPDX-License-Identifier: Apache-2.0
-->

# OIM 2.0 — Rendering rules

The 2.0 contract describes what is painted, not how a browser paints it. Every reader
(web, Flutter, native) applies these rules with its own tools, and the 2.0 goldens
(`vectors-2/golden`) are the executable check. 1.x files are not painted by readers:
they are upgraded once by a tool (`oim upgrade`, or the editor on import).

## Box

`box` is the painted rectangle: `x`/`y` is its top-left corner in design pixels and
`width`/`height` its size. There is no implicit centring and no relative unit.
`anchor` (a text fitted to its content) is the only case where `x`/`y` is an anchor
point instead of a corner.

## Strokes

By default (`align` absent or `"center"`) a stroke is centred on the geometry's edge:
half inside, half outside. `"inside"` puts it wholly inside, `"outside"` wholly
outside. The box never changes size because of a stroke.

Example: a 400 × 200 box at (80, 80) with a 10 px stroke. The stroke's outer edges are

| `align` | x | y |
|---|---|---|
| `center` | 75 – 485 | 75 – 285 |
| `inside` | 80 – 480 | 80 – 280 |
| `outside` | 70 – 490 | 70 – 290 |

## Text without runs

A text with no `textRuns` is aligned by `text.align` and centred vertically in its box.
