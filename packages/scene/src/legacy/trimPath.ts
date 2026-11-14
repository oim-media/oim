/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Name of the shared @keyframes that draws the outline.
 *
 * A single rule for all layers: the ends of the path travel in two CSS
 * variables per element, so there is no need for a @keyframes per shape. Same
 * pattern as `ensureWaveKeyframes` in the wave animation.
 */
export const TRIM_KEYFRAMES_NAME = 'oim-trim-draw';

/** The rule itself. It is injected once per shadow root. */
export const TRIM_KEYFRAMES_CSS =
  '@keyframes ' + TRIM_KEYFRAMES_NAME + ' {\n' +
  '  from { stroke-dashoffset: var(--oim-trim-from); }\n' +
  '  to { stroke-dashoffset: var(--oim-trim-to); }\n' +
  '}';

/** Trim style, which may also carry the draw animation. */
export interface TrimCss {
  strokeDasharray?: string;
  strokeDashoffset?: number;
  animation?: string;
  '--oim-trim-from'?: string;
  '--oim-trim-to'?: string;
}

/**
 * Turns the stroke trim into `stroke-dasharray` / `stroke-dashoffset`, plus
 * the draw animation when `trimDuration` is above 0.
 *
 * Twin of the editor's trimPath, duplicated on purpose and pinned by a twin
 * test (see trimPath.test.ts for why parity matters).
 *
 * The caller measures `longitud` with getTotalLength() on the <path>; it is a
 * parameter so this function needs no DOM and stays testable.
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

  // Full outline with no animation: there is nothing to trim, and a useless
  // dasharray would only add work for the compositor.
  //
  // WITH animation there IS work to do even when the trim is complete: drawing
  // a whole icon from start to finish is exactly the most common case, and
  // before, that `return {}` left it unanimated.
  if (start <= 0 && end >= 100 && duration <= 0) return {};

  const visible = Math.max(0, (end - start) / 100) * length;
  const hidden = length;
  const offsetFinal = -(start / 100) * length || 0;

  const css: TrimCss = {
    strokeDasharray: `${visible} ${hidden}`,
    strokeDashoffset: offsetFinal
  };

  if (duration > 0) {
    // The stroke starts offset by exactly its own length —invisible— and travels
    // to its final position. `forwards` leaves it drawn when it ends, rather
    // than returning it to the initial state.
    css['--oim-trim-from'] = `${offsetFinal + visible}px`;
    css['--oim-trim-to'] = `${offsetFinal}px`;
    css.animation = `${TRIM_KEYFRAMES_NAME} ${duration}s ease-out forwards`;
  }

  return css;
}

/** Injects the draw @keyframes once per shadow root. */
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
 * Applies trim path to every <path> inside a DOM element.
 * Meant to be called after the SVG is injected inline into the slot.
 */
export function applyTrimToSvgPaths(
  container: Element,
  style: { strokeWidth?: number; trimStart?: number; trimEnd?: number; trimDuration?: number }
): void {
  // `SVGGeometryElement` and not `Element`: it is the type that declares
  // `getTotalLength()` and `style`, which is what this loop uses. Without it,
  // the six accesses down here were six `typecheck` errors -on correct code- and
  // `querySelectorAll` has no way of knowing that on its own.
  //
  // The seven selectors are all SVG geometry elements, so the claim is true by
  // construction: none of them fails to meet it.
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
      // Draw animation: the variables carry the ends of the path,
      // and the shared @keyframes does the rest.
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
