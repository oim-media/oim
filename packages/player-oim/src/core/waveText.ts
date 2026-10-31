/**
 * The "wave" text animation (wave-chars), declared as native CSS.
 *
 * Twin of the editor's waveText; the formula is duplicated on purpose, like
 * layerComposition. If the constants change there, they change here.
 *
 * Declared as @keyframes rather than sampling the curve into discrete
 * keyframes: the browser interpolates natively, so the wave stays smooth, is
 * GPU-composited, and loops forever without a JS loop.
 */

const WAVE_ANGULAR_FREQUENCY = 6;
const WAVE_AMPLITUDE_PX = 5;

/** Samples per cycle. With 4, linear interpolation looks triangular; with 8
 *  it is indistinguishable from a real wave. */
const WAVE_SAMPLES = 8;

export const WAVE_PERIOD_SECONDS = (2 * Math.PI) / WAVE_ANGULAR_FREQUENCY;

export const WAVE_KEYFRAMES_NAME = 'oim-wave-chars';

export function buildWaveKeyframesCss(): string {
  const stops: string[] = [];
  for (let i = 0; i <= WAVE_SAMPLES; i++) {
    const fraction = i / WAVE_SAMPLES;
    const percent = parseFloat((fraction * 100).toFixed(4));
    // sin(2π · fraction): one full cycle between 0% and 100%, starting and
    // ending at 0 so that the loop does not jump.
    const y = Math.sin(fraction * 2 * Math.PI) * WAVE_AMPLITUDE_PX;
    const rounded = parseFloat(y.toFixed(4));
    stops.push(`  ${percent}% { transform: translateY(${rounded}px); }`);
  }
  return `@keyframes ${WAVE_KEYFRAMES_NAME} {\n${stops.join('\n')}\n}`;
}

/**
 * Seconds. Always negative (or the global `delay`), on purpose.
 *
 * The convention is the same as in the editor: each character is **delayed**
 * `idx × speed` seconds relative to the previous one (`sin(ω·(t − delay − idx·speed))`),
 * same as the rest of the text presets.
 *
 * But a POSITIVE `animation-delay` does not shift the phase: it FREEZES the
 * element at the 0% keyframe until the clock reaches it. Only a negative delay
 * truly shifts the phase, by advancing the animation. Since the wave is periodic
 * and infinite, a delay of `lag` is indistinguishable from an advance of
 * `period − lag`: that is where the module dance comes from. The double modulo
 * normalizes `lag` to the range [0, period) even with a negative `speed`, and
 * the final `% period` turns `lag = 0` into an advance of 0 (not of a whole
 * period), so that character 0 keeps the global `delay` exactly.
 */
export function waveCharAnimationDelay(
  charIndex: number,
  speed: number,
  delay: number
): number {
  const lag = (((charIndex * speed) % WAVE_PERIOD_SECONDS) + WAVE_PERIOD_SECONDS) % WAVE_PERIOD_SECONDS;
  return delay - ((WAVE_PERIOD_SECONDS - lag) % WAVE_PERIOD_SECONDS);
}
