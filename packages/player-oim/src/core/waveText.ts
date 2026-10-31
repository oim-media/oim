/**
 * Animación de text "ola" (wave-chars) declarada como CSS nativo.
 *
 * Gemelo portado de OIM-Studio/src/animation/waveText.ts. Los dos repos no
 * comparten paquete, así que la fórmula está duplicada a propósito, igual que
 * layerComposition. Si cambian las constantes allí, hay que replicarlas aquí.
 *
 * Se declara como @keyframes en vez de muestrear la curva a keyframes
 * discretos: el navegador interpola nativamente, así que la ola se ve fluida y
 * continua, la compone la GPU, y cicla infinitamente sin un bucle de JS.
 */

const WAVE_ANGULAR_FREQUENCY = 6;
const WAVE_AMPLITUDE_PX = 5;

/** Muestras por ciclo. Con 4 la interpolación lineal se ve triangular; con 8
 *  es indistinguible de una onda real. */
const WAVE_SAMPLES = 8;

export const WAVE_PERIOD_SECONDS = (2 * Math.PI) / WAVE_ANGULAR_FREQUENCY;

export const WAVE_KEYFRAMES_NAME = 'oim-wave-chars';

export function buildWaveKeyframesCss(): string {
  const stops: string[] = [];
  for (let i = 0; i <= WAVE_SAMPLES; i++) {
    const fraction = i / WAVE_SAMPLES;
    const percent = parseFloat((fraction * 100).toFixed(4));
    // sin(2π · fracción): un ciclo completo entre 0% y 100%, arrancando y
    // cerrando en 0 para que el bucle no dé un salto.
    const y = Math.sin(fraction * 2 * Math.PI) * WAVE_AMPLITUDE_PX;
    const rounded = parseFloat(y.toFixed(4));
    stops.push(`  ${percent}% { transform: translateY(${rounded}px); }`);
  }
  return `@keyframes ${WAVE_KEYFRAMES_NAME} {\n${stops.join('\n')}\n}`;
}

/**
 * Segundos. Siempre negativo (o el `delay` global), a propósito.
 *
 * La convención es la misma que en el editor: cada carácter va **retrasado**
 * `idx × speed` segundos respecto al anterior (`sin(ω·(t − delay − idx·speed))`),
 * igual que el resto de presets de text.
 *
 * Pero un `animation-delay` POSITIVO no desfasa: CONGELA el elemento en el
 * keyframe 0% hasta que el reloj lo alcanza. Lo único que desfasa de verdad es
 * un delay negativo, que adelanta la animación. Como la onda es periódica e
 * infinita, un retraso de `lag` es indistinguible de un adelanto de
 * `periodo − lag`: ahí sale el baile de módulos. El módulo doble normaliza
 * `lag` al rango [0, periodo) incluso con `speed` negativo, y el `% periodo`
 * final convierte `lag = 0` en un adelanto de 0 (no de un periodo entero), para
 * que el carácter 0 conserve exactamente el `delay` global.
 */
export function waveCharAnimationDelay(
  charIndex: number,
  speed: number,
  delay: number
): number {
  const lag = (((charIndex * speed) % WAVE_PERIOD_SECONDS) + WAVE_PERIOD_SECONDS) % WAVE_PERIOD_SECONDS;
  return delay - ((WAVE_PERIOD_SECONDS - lag) % WAVE_PERIOD_SECONDS);
}
