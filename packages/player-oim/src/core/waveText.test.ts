import { describe, it, expect } from "vitest";
import {
  WAVE_PERIOD_SECONDS,
  WAVE_KEYFRAMES_NAME,
  buildWaveKeyframesCss,
  waveCharAnimationDelay,
} from "./waveText";

describe("WAVE_PERIOD_SECONDS", () => {
  it("matches a 6 rad/s angular frequency", () => {
    expect(WAVE_PERIOD_SECONDS).toBeCloseTo((2 * Math.PI) / 6, 6);
  });
});

describe("buildWaveKeyframesCss", () => {
  const css = buildWaveKeyframesCss();

  it("declares a keyframes rule under the shared name", () => {
    expect(css).toContain(`@keyframes ${WAVE_KEYFRAMES_NAME}`);
  });

  it("samples the cycle at 8 points plus the closing 100% stop", () => {
    const stops = css.match(/\d+(\.\d+)?%\s*\{/g) || [];
    expect(stops).toHaveLength(9);
    expect(css).toContain("0%");
    expect(css).toContain("12.5%");
    expect(css).toContain("50%");
    expect(css).toContain("87.5%");
    expect(css).toContain("100%");
  });

  it("starts and ends at zero offset so the loop is seamless", () => {
    const first = css.match(/0%\s*\{\s*transform:\s*translateY\((-?[\d.]+)px\)/);
    const last = css.match(/100%\s*\{\s*transform:\s*translateY\((-?[\d.]+)px\)/);
    expect(parseFloat(first![1])).toBeCloseTo(0, 3);
    expect(parseFloat(last![1])).toBeCloseTo(0, 3);
  });

  it("peaks at +5px a quarter of the way through", () => {
    const quarter = css.match(/25%\s*\{\s*transform:\s*translateY\((-?[\d.]+)px\)/);
    expect(parseFloat(quarter![1])).toBeCloseTo(5, 3);
  });

  it("troughs at -5px three quarters through", () => {
    const threeQuarters = css.match(/75%\s*\{\s*transform:\s*translateY\((-?[\d.]+)px\)/);
    expect(parseFloat(threeQuarters![1])).toBeCloseTo(-5, 3);
  });

  it("never exceeds the amplitude envelope", () => {
    const values = [...css.matchAll(/translateY\((-?[\d.]+)px\)/g)].map((m) => parseFloat(m[1]));
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(Math.abs(v)).toBeLessThanOrEqual(5 + 1e-6);
  });
});

describe("waveCharAnimationDelay", () => {
  it("is zero for the first character with no global delay", () => {
    expect(waveCharAnimationDelay(0, 0.05, 0)).toBeCloseTo(0, 6);
  });

  // Un retraso de `idx*speed` se expresa en CSS como un adelanto de
  // `periodo - idx*speed`, porque un animation-delay positivo congela en vez de
  // desfasar. Con periodo = 2π/6 = 1.0471975511965976:
  //   idx=3, speed=0.05 -> lag 0.15 -> 0 - (1.0471975511965976 - 0.15)
  it("lags later characters, expressed as a lead of one period minus the lag", () => {
    expect(waveCharAnimationDelay(3, 0.05, 0)).toBeCloseTo(-0.8971975511965976, 6);
  });

  it("adds the global delay on top of the per-character stagger", () => {
    // idx=2, speed=0.05 -> lag 0.1 -> 1 - (1.0471975511965976 - 0.1)
    expect(waveCharAnimationDelay(2, 0.05, 1)).toBeCloseTo(0.0528024488034024, 6);
  });

  it("puts every character in unison when speed is zero", () => {
    expect(waveCharAnimationDelay(9, 0, 0)).toBeCloseTo(0, 6);
  });
});
