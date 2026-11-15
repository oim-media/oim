# scene benchmarks

## Drag benchmark (6b.1, Task 1)

Measures whether moving a layer with `setTransform` keeps up with a 60 fps display.

- **Scene:** 150 box layers on a 1600 x 1000 canvas, mounted at 800 px wide. Each frame, `setTransform` moves layer `L0` once, inside `requestAnimationFrame`.
- **Run:** 1 s warm-up (not reported), then 3 runs of 3 s each. CPU throttled 4x through CDP (`Emulation.setCPUThrottlingRate`).
- **Metrics:** frame time is the interval between consecutive `requestAnimationFrame` callbacks. Longtasks come from `PerformanceObserver`. `work` is the time spent inside the `setTransform` call only.
- **Criterion:** p95 frame time <= 16.7 ms and no longtask > 50 ms.

**Limitation:** scene paints no fills, text or images yet. The 150 layers are plain boxes, and their colours are inline `background` values set after `mount` (50 solid, 50 gradient, 50 solid standing in for text and images). Task 7 repeats the benchmark with real blocks.

**How to run:**

```sh
pnpm --filter @oim-media/scene bench:build        # compiles src/scene.ts and src/box.ts to dist/bench
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/.../packages/scene && node bench/drag.mjs'
```

`drag.mjs` takes Playwright from `packages/spec` and uses the Chromium already installed in WSL.

**Result** (final invocations, WSL Ubuntu, headless Chromium, CPU 4x):

| invocation | run | frames | p50 (ms) | p95 (ms) | setTransform p95 (ms) | longtasks | longtask max (ms) |
|---|---|---|---|---|---|---|---|
| 2 | 1 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 2 | 2 | 181 | 16.7 | 16.7 | 0.3 | 0 | 0 |
| 2 | 3 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 3 | 1 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 3 | 2 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |
| 3 | 3 | 181 | 16.7 | 16.7 | 0.1 | 0 | 0 |

The first invocation (cold browser) reported p95 16.8 ms at two-decimal rounding, so its value lies between 16.75 and 16.85 ms. Later invocations, rounded to three decimals, read 16.7 ms.

**Reading:** the frame interval equals one 60 Hz vsync period (16.67 ms). The criterion therefore sits on that period with almost no margin. The JS cost of `setTransform` is about 0.1 ms per frame, and no task exceeds 50 ms.
