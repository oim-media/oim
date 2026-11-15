# scene benchmarks

## Drag benchmark (6b.1)

Measures whether moving a layer with `setTransform` keeps up with a 60 fps display.

- **Scene:** `drag.html` mounts 150 layers on a 1600 x 1000 canvas, 800 px wide. Each frame, `setTransform` moves layer `L0` once, inside `requestAnimationFrame`.
- **Layers (6b.1 final):** 100 shapes (50 solid, 50 gradient; every fifth one with a 2 px stroke and 4 px corners), 40 texts, 10 pictures (a `data:` PNG). These are the real blocks scene paints.
- **Run:** 1 s warm-up (not reported), then 3 runs of 3 s each. CPU throttled 4x through CDP (`Emulation.setCPUThrottlingRate`).
- **Metrics:** frame time is the interval between consecutive `requestAnimationFrame` callbacks. Longtasks come from `PerformanceObserver`. `work` is the time spent inside the `setTransform` call only.

### Criterion

Frames are capped at one 60 Hz vsync (16.67 ms). A p95 of 16.7 ms therefore means "no dropped frames" and nothing more, so the criterion is:

- **dropped frames** (frame interval > 25 ms) **<= 1 %** of the frames of each run, and
- **no longtask > 50 ms**, at CPU 4x.

The p95 is still reported. The first criterion (p95 <= 16.7 ms) is kept only as the Task 1 record below.

### How to run

```sh
pnpm --filter @oim-media/scene bench:build        # bundles bench/scene-entry.ts into dist/bench/scene.js
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/.../packages/scene && node bench/drag.mjs'
```

`drag.mjs` takes Playwright from `packages/spec` and uses the Chromium already installed in WSL.

### Result, 6b.1 final (real blocks; WSL Ubuntu, headless Chromium, CPU 4x)

| run | frames | p50 (ms) | p95 (ms) | dropped (%) | setTransform p95 (ms) | longtasks | longtask max (ms) |
|---|---|---|---|---|---|---|---|
| 1 | 181 | 16.7 | 16.7 | 0 | 0.2 | 0 | 0 |
| 2 | 181 | 16.7 | 16.7 | 0 | 0.4 | 0 | 0 |
| 3 | 181 | 16.7 | 16.7 | 0 | 0.4 | 0 | 0 |

Verdict: **pass** (worst dropped 0 %, worst longtask 0 ms).

### Result, Task 1 (150 plain boxes, old criterion; kept for comparison)

| invocation | run | frames | p50 (ms) | p95 (ms) | setTransform p95 (ms) | longtasks | longtask max (ms) |
|---|---|---|---|---|---|---|---|
| 2 | 1 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 2 | 2 | 181 | 16.7 | 16.7 | 0.3 | 0 | 0 |
| 2 | 3 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 3 | 1 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 3 | 2 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 3 | 3 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |

The first invocation (cold browser) reported p95 16.8 ms at two-decimal rounding. The p95 equals the vsync period, which is why it cannot separate a dropped frame from a late one. The plain-box page is not kept: the real-block page above replaces it.
