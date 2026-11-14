#!/usr/bin/env node
// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Renders every conformance vector with the web player (the reference renderer).
// Usage: node render-web-goldens.mjs <out-dir> [--suffix .web]
// Goldens are only valid when produced on the CI runner's Linux: fonts rasterise
// differently elsewhere.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// OIM_VECTORS renders any folder of works (e.g. real files) instead of the conformance vectors.
// OIM_PALETTE picks a named palette, to compare a work's palettes across renderers.
const PALETTE = process.env.OIM_PALETTE;
const VECTORS = process.env.OIM_VECTORS ?? path.join(HERE, '..', 'vectors');
const PLAYER = path.join(HERE, '..', '..', 'player-oim', 'dist', 'oim-player.js');
const WIDTH = 800;

const args = process.argv.slice(2);
const outDir = args[0];
const suffixAt = args.indexOf('--suffix');
const suffix = suffixAt >= 0 ? args[suffixAt + 1] : '.web';
if (!outDir) {
  console.error('usage: render-web-goldens.mjs <out-dir> [--suffix .web]');
  process.exit(2);
}
if (!fs.existsSync(PLAYER)) {
  console.error(`player bundle not found: ${PLAYER} (run pnpm build first)`);
  process.exit(2);
}

// Output size is fixed by the vector's PNG header so every renderer produces the same size.
const goldenSize = (pngBytes) => {
  const w = pngBytes.readUInt32BE(16), h = pngBytes.readUInt32BE(20);
  return { width: WIDTH, height: Math.round((WIDTH * h) / w) };
};

// geometricPrecision: headless Linux Chrome otherwise rounds each glyph advance to whole px,
// so a line can fit where the exact width (editor, Flutter, Windows) wraps it.
const page = (src, height) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff;font-family:sans-serif}oim-player{display:block;text-rendering:geometricPrecision;width:${WIDTH}px;height:${height}px}</style>
<script src="/oim-player.js"></script></head>
<body><oim-player id="p" src="${src}" disable-animations="true"${PALETTE ? ` palette="${PALETTE}"` : ''}></oim-player></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/oim-player.js') return res.end(fs.readFileSync(PLAYER));
  // What the player fetches next to itself: `upgrade` and Lottie.
  const vendor = path.join(path.dirname(PLAYER), 'vendor', path.basename(url));
  if (url.startsWith('/vendor/') && fs.existsSync(vendor)) {
    res.setHeader('content-type', 'text/javascript');
    return res.end(fs.readFileSync(vendor));
  }
  if (url.startsWith('/page/')) {
    res.setHeader('content-type', 'text/html');
    const name = path.basename(url);
    return res.end(page(`/vectors/${name}`, goldenSize(fs.readFileSync(path.join(VECTORS, name))).height));
  }
  const file = path.join(VECTORS, path.basename(url));
  if (url.startsWith('/vectors/') && fs.existsSync(file)) {
    res.setHeader('content-type', 'image/png');
    return res.end(fs.readFileSync(file));
  }
  res.statusCode = 404;
  res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

fs.mkdirSync(outDir, { recursive: true });
// Grey anti-aliasing: LCD text fringes depend on the screen and no other renderer draws them.
const browser = await chromium.launch({ args: ['--disable-lcd-text'] });
const context = await browser.newContext({ viewport: { width: WIDTH, height: 4000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
let failed = 0;
for (const file of fs.readdirSync(VECTORS).filter((f) => f.endsWith('.oim.png')).sort()) {
  const name = file.slice(0, -'.oim.png'.length);
  const tab = await context.newPage();
  try {
    await tab.addInitScript(() => {
      ['oim:loaded', 'oim:unsupported', 'oim:incomplete', 'error'].forEach((e) =>
        document.addEventListener(e, () => { window.__oimSettled = e; }, { capture: true }));
    });
    await tab.goto(`${base}/page/${file}`);
    await tab.waitForFunction(() => window.__oimSettled, null, { timeout: 15000 }).catch(() => {});
    await tab.evaluate(() => document.fonts.ready);
    await tab.evaluate(() => Promise.all([...document.images, ...document.querySelectorAll('*')].flatMap((el) =>
      el.shadowRoot ? [...el.shadowRoot.querySelectorAll('img')] : el instanceof HTMLImageElement ? [el] : [],
    ).map((img) => img.decode().catch(() => {}))));
    // Two frames: the engine lays out after load.
    await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    // A golden painted without `upgrade` would be the 1.x road, not the one that ships.
    if (!(await tab.evaluate(() => typeof window.__oimUpgrade === 'function'))) throw new Error('upgrade did not load');
    await tab.locator('#p').screenshot({ path: path.join(outDir, `${name}${suffix}.png`), animations: 'disabled' });
    console.log(`rendered ${name}`);
  } catch (err) {
    failed++;
    console.error(`✖ ${name}: ${err.message}`);
  } finally {
    await tab.close();
  }
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
