#!/usr/bin/env node
// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Renders every conformance vector with the web player (the reference renderer).
// Usage: node render-web-goldens.mjs <out-dir> [--suffix .web] [--renderer web|scene]
// `--renderer scene` paints each vector with @oim-media/scene (packages/scene/dist/scene-page.js).
// A vector the scene does not paint yet writes `<name>.skipped` instead of a PNG.
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
const SCENE_PAGE = path.join(HERE, '..', '..', 'scene', 'dist', 'scene-page.js');
const WIDTH = 800;

const args = process.argv.slice(2);
const outDir = args[0];
const suffixAt = args.indexOf('--suffix');
const suffix = suffixAt >= 0 ? args[suffixAt + 1] : '.web';
const rendererAt = args.indexOf('--renderer');
const renderer = rendererAt >= 0 ? args[rendererAt + 1] : 'web';
if (!outDir || !['web', 'scene'].includes(renderer)) {
  console.error('usage: render-web-goldens.mjs <out-dir> [--suffix .web] [--renderer web|scene]');
  process.exit(2);
}
const ENTRY = renderer === 'scene' ? SCENE_PAGE : PLAYER;
if (!fs.existsSync(ENTRY)) {
  console.error(`${renderer} bundle not found: ${ENTRY} (run pnpm build first)`);
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

// The scene page: the same frame as the player's, with the vector's file read by the page itself.
const scenePage = (name, height) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff;font-family:sans-serif}#host{width:${WIDTH}px;height:${height}px;text-rendering:geometricPrecision;position:relative}</style>
<script type="module" src="/scene-page.js"></script></head>
<body><div id="host" data-src="/vectors/${name}"></div></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/oim-player.js') return res.end(fs.readFileSync(PLAYER));
  if (url === '/scene-page.js') {
    res.setHeader('content-type', 'text/javascript');
    return res.end(fs.readFileSync(SCENE_PAGE));
  }
  if (url.startsWith('/scene/')) {
    res.setHeader('content-type', 'text/html');
    const name = path.basename(url);
    return res.end(scenePage(name, goldenSize(fs.readFileSync(path.join(VECTORS, name))).height));
  }
  // What the player fetches next to itself: Lottie and the on-demand parts.
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
  // A stale result of an earlier run must not stand for this one.
  for (const stale of [`${name}.skipped`, `${name}${suffix}.png`]) fs.rmSync(path.join(outDir, stale), { force: true });
  try {
    await tab.addInitScript(() => {
      ['oim:loaded', 'oim:unsupported', 'oim:incomplete', 'error'].forEach((e) =>
        document.addEventListener(e, () => { window.__oimSettled = e; }, { capture: true }));
    });
    await tab.goto(`${base}/${renderer === 'scene' ? 'scene' : 'page'}/${file}`);
    await tab.waitForFunction(() => window.__oimSettled, null, { timeout: 15000 }).catch(() => {});
    if (renderer === 'scene') {
      const skipped = await tab.evaluate(() => (window.__oimSettled === 'skipped' ? window.__oimSkip : null));
      if (skipped) {
        fs.writeFileSync(path.join(outDir, `${name}.skipped`), JSON.stringify(skipped));
        console.log(`skipped ${name}: ${skipped.join(', ')}`);
        continue;
      }
      if ((await tab.evaluate(() => window.__oimSettled)) !== 'loaded') throw new Error('scene did not mount the file');
    }
    await tab.evaluate(() => document.fonts.ready);
    await tab.evaluate(() => Promise.all([...document.images, ...document.querySelectorAll('*')].flatMap((el) =>
      el.shadowRoot ? [...el.shadowRoot.querySelectorAll('img')] : el instanceof HTMLImageElement ? [el] : [],
    ).map((img) => img.decode().catch(() => {}))));
    // Two frames: the engine lays out after load.
    await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await tab.locator(renderer === 'scene' ? '#host' : '#p').screenshot({ path: path.join(outDir, `${name}${suffix}.png`), animations: 'disabled' });
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
