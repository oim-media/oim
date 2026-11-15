/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Drag benchmark for @oim-media/scene: 150 layers, one setTransform per frame, CPU throttled 4x.
// Run in WSL after `pnpm bench:build`: node bench/drag.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// Playwright is installed by the spec package; resolve it from there.
const { chromium } = createRequire(path.resolve(ROOT, '../spec/package.json'))('playwright');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(ROOT, '.' + (url === '/' ? '/bench/drag.html' : url));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const percentile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : NaN;
};
const round = (x) => +x.toFixed(3);

const RUNS = 3;
const MS = 3000;
const browser = await chromium.launch({ args: ['--disable-lcd-text'] });
try {
  const tab = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  const cdp = await tab.context().newCDPSession(tab);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await tab.goto(`${base}/`);
  await tab.waitForFunction(() => window.__ready === true);
  await tab.evaluate((ms) => window.runDrag(ms), 1000); // warm-up, not reported

  const report = [];
  for (let run = 1; run <= RUNS; run++) {
    const r = await tab.evaluate((ms) => window.runDrag(ms), MS);
    // A frame is dropped when its interval is over 25 ms: the display shows a 60 Hz vsync every 16.67 ms, so a p95 cannot tell a dropped frame from a late one.
    const dropped = r.frames.filter((f) => f > 25).length / r.frames.length;
    const row = {
      run,
      frames: r.frames.length,
      p50: round(percentile(r.frames, 50)),
      p95: round(percentile(r.frames, 95)),
      droppedPct: round(dropped * 100),
      workP95: round(percentile(r.work, 95)),
      longtasks: r.longtasks.length,
      longtaskMax: round(Math.max(0, ...r.longtasks)),
    };
    report.push(row);
    console.log(JSON.stringify(row));
  }
  const worstP95 = Math.max(...report.map((r) => r.p95));
  const worstDropped = Math.max(...report.map((r) => r.droppedPct));
  const worstLongtask = Math.max(...report.map((r) => r.longtaskMax));
  const pass = worstDropped <= 1 && worstLongtask <= 50;
  console.log(JSON.stringify({ worstP95, worstDropped, worstLongtask, criterion: 'dropped frames (interval > 25 ms) <= 1 % and no longtask > 50 ms, CPU 4x', pass }));
} finally {
  await browser.close();
  server.close();
}
