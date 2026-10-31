/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nombre del @keyframes compartido que dibuja el contorno.
 *
 * Una sola regla para todas las capas: los extremos del recorrido viajan en
 * dos variables CSS por elemento, asi que no hace falta un @keyframes por
 * figura. Mismo patron que `ensureWaveKeyframes` en la animacion de ola.
 */
export const TRIM_KEYFRAMES_NAME = 'oim-trim-draw';

/** La regla en si. Se inyecta una vez por shadow root. */
export const TRIM_KEYFRAMES_CSS =
  '@keyframes ' + TRIM_KEYFRAMES_NAME + ' {\n' +
  '  from { stroke-dashoffset: var(--oim-trim-from); }\n' +
  '  to { stroke-dashoffset: var(--oim-trim-to); }\n' +
  '}';

/** Estilo de recorte, que puede llevar ademas la animacion de dibujado. */
export interface TrimCss {
  strokeDasharray?: string;
  strokeDashoffset?: number;
  animation?: string;
  '--oim-trim-from'?: string;
  '--oim-trim-to'?: string;
}

/**
 * Traduce el recorte de contorno a `stroke-dasharray` / `stroke-dashoffset`,
 * y la animacion de dibujado cuando `trimDuration` es mayor que 0.
 *
 * Gemela de OIM-Studio/src/lib/trimPath.ts. Los dos repos no comparten
 * paquete, asi que la funcion esta duplicada a proposito — y por eso su
 * prueba tambien. El editor y el visor implementaron por separado la misma
 * onda senoidal y salieron en direcciones opuestas; las 224 pruebas pasaron
 * porque coincidian en el primer caracter.
 *
 * `longitud` la mide quien llama, con getTotalLength() sobre el <path>. Se
 * pasa como parametro para que esta funcion no necesite DOM y sea probable.
 */
export function getTrimCss(
  style: { strokeWidth?: number; trimStart?: number; trimEnd?: number; trimDuration?: number },
  length: number
): TrimCss {
  if (!length || length <= 0) return {};
  if (!style.strokeWidth) return {};

  const start = style.trimStart ?? 0;
  const end = style.trimEnd ?? 100;
  const duration = style.trimDuration ?? 0;

  // Contorno completo y sin animacion: no hay nada que recortar, y un
  // dasharray inutil solo añadiria trabajo al compositor.
  //
  // Con animacion SI hay trabajo que hacer aunque el recorte sea completo:
  // dibujar un icono entero de principio a fin es justamente el caso mas
  // habitual, y antes ese `return {}` lo dejaba sin animar.
  if (start <= 0 && end >= 100 && duration <= 0) return {};

  const visible = Math.max(0, (end - start) / 100) * length;
  const hidden = length;
  const offsetFinal = -(start / 100) * length || 0;

  const css: TrimCss = {
    strokeDasharray: `${visible} ${hidden}`,
    strokeDashoffset: offsetFinal
  };

  if (duration > 0) {
    // El trazo arranca desplazado justo su propia longitud —invisible— y
    // recorre hasta su posicion final. `forwards` lo deja dibujado al acabar,
    // no lo devuelve al estado inicial.
    css['--oim-trim-from'] = `${offsetFinal + visible}px`;
    css['--oim-trim-to'] = `${offsetFinal}px`;
    css.animation = `${TRIM_KEYFRAMES_NAME} ${duration}s ease-out forwards`;
  }

  return css;
}

/** Inyecta el @keyframes del dibujado una sola vez por shadow root. */
export function ensureTrimKeyframes(shadowRoot: ShadowRoot | null): void {
  if (!shadowRoot) return;
  const styleId = 'oim-trim-keyframes';
  if (shadowRoot.getElementById(styleId)) return;
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = TRIM_KEYFRAMES_CSS;
  shadowRoot.appendChild(styleEl);
}

/**
 * Aplica trim path a todos los <path> dentro de un elemento del DOM.
 * Pensado para llamarse después de inyectar el SVG inline en el slot.
 */
export function applyTrimToSvgPaths(
  container: Element,
  style: { strokeWidth?: number; trimStart?: number; trimEnd?: number; trimDuration?: number }
): void {
  // `SVGGeometryElement` y no `Element`: es el tipo que declara
  // `getTotalLength()` y `style`, que es lo que este bucle usa. Sin el, los
  // seis accesos de aqui abajo eran seis errores de `typecheck` -sobre codigo
  // correcto- y `querySelectorAll` no tiene forma de saberlo sola.
  //
  // Los siete selectores son todos elementos de geometria SVG, asi que la
  // afirmacion es cierta por construccion: no hay ninguno que no lo cumpla.
  const paths = container.querySelectorAll<SVGGeometryElement>(
    'path, circle, rect, polygon, polyline, ellipse, line'
  );
  paths.forEach(function (path) {
    try {
      const len = path.getTotalLength();
      const css = getTrimCss(style, len);
      if (css.strokeDasharray) {
        path.style.strokeDasharray = css.strokeDasharray;
        path.style.strokeDashoffset = String(css.strokeDashoffset ?? 0);
      }
      // Animacion de dibujado: las variables llevan los extremos del recorrido
      // y el @keyframes compartido hace el resto.
      if (css.animation) {
        path.style.setProperty('--oim-trim-from', css['--oim-trim-from'] || '0px');
        path.style.setProperty('--oim-trim-to', css['--oim-trim-to'] || '0px');
        path.style.animation = css.animation;
      }
    } catch (_e) {
      // getTotalLength() may fail on paths not attached to the DOM
    }
  });
}
