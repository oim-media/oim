/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Text animations that redraw the words themselves: a wave per character, typed letters, a glitch.
import { WAVE_KEYFRAMES_NAME, WAVE_PERIOD_SECONDS, waveCharAnimationDelay } from './waveText.js';
import { calculateTypewriterState } from './typewriterText.js';
import { calculateGlitchState, glitchLayers } from '../../../core/src/glitch.js';

/**
 * Replaces the content of `hoverWrap` with one <span> per character, each
 * with the wave animation offset according to its index.
 *
 * The animation is declared in CSS and interpolated by the browser: there is no
 * rAF loop nor sampled keyframes. The @keyframes itself is injected by
 * ensureWaveKeyframes() only once per shadow root.
 */
export function applyWaveText(
  hoverWrap: HTMLElement,
  text: string,
  speed: number,
  delay: number
): void {
  hoverWrap.textContent = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\n') {
      hoverWrap.appendChild(document.createElement('br'));
      continue;
    }
    const span = document.createElement('span');
    // A normal space inside an inline-block collapses and the next letter
    // sticks to it; the no-breaking space keeps the gap.
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    span.style.display = 'inline-block';
    span.style.animationName = WAVE_KEYFRAMES_NAME;
    span.style.animationDuration = WAVE_PERIOD_SECONDS + 's';
    span.style.animationTimingFunction = 'linear';
    span.style.animationIterationCount = 'infinite';
    span.style.animationDelay = waveCharAnimationDelay(i, speed, delay) + 's';
    hoverWrap.appendChild(span);
  }
}

/**
 * A text animation driven by a JavaScript timer. It has to be paused by hand:
 * the `oim-player-paused` class only reaches CSS animations. `pause()` stops
 * the timer and freezes the clock, so `play()` resumes where it was.
 */
export interface TimedTextAnimation { pause(): void; play(): void; stop(): void }

function timedText(everyMs: number, frame: (seconds: number) => void, onStop?: () => void): TimedTextAnimation {
  let elapsed = 0, since = performance.now(), id: ReturnType<typeof setInterval> | null = null;
  const now = () => elapsed + (id === null ? 0 : performance.now() - since);
  const tick = () => frame(now() / 1e3);
  const play = () => { if (id !== null) return; since = performance.now(); id = setInterval(tick, everyMs); };
  const pause = () => { if (id === null) return; elapsed = now(); clearInterval(id); id = null; };
  play();
  return { pause, play, stop: () => { pause(); onStop?.(); } };
}

export function applyTypewriterText(el: HTMLElement, text: string, speed = 20, delay = 0, cursor = true): TimedTextAnimation {
  const draw = (t: number) => {
    const s = calculateTypewriterState(text, t, speed, delay, cursor, false);
    el.textContent = s.visibleText + (s.showCursor ? '|' : '');
  };
  draw(0);
  return timedText(40, draw);
}

/**
 * The glitch as portable primitives (@oim-media/core glitchLayers): the text with a
 * skew plus a fixed set of copies — two colour ghosts (cyberpunk) or one
 * shifted band cut by a rectangle (slice) — offset and faded. No text-shadow:
 * a native renderer draws the same layers. Out of a burst the copies are at
 * opacity 0 and nothing else changes.
 */
export function applyGlitchText(el: HTMLElement, text: string, type: 'glitch-cyberpunk' | 'glitch-slice', speed = 1, delay = 0, intensity = 50): TimedTextAnimation {
  el.textContent = '';
  el.style.display = 'inline-block';
  el.style.position = 'relative';
  const layer = () => { const sp = document.createElement('span'); sp.textContent = text; return sp; };
  const first = glitchLayers(type, calculateGlitchState(0));
  const copies = first.copies.map((c) => {
    const sp = layer();
    sp.setAttribute('aria-hidden', 'true');
    const st = sp.style;
    st.position = 'absolute'; st.left = '0'; st.top = '0'; st.width = '100%'; st.height = '100%';
    st.pointerEvents = 'none'; st.opacity = '0';
    if (c.color) st.color = c.color;
    return sp;
  });
  const base = layer();
  base.style.position = 'relative';
  // Ghosts behind the text, the band over it.
  if (type === 'glitch-slice') el.append(base, ...copies); else el.append(...copies, base);
  const draw = (t: number) => {
    const f = glitchLayers(type, calculateGlitchState(t, speed, delay, intensity));
    el.style.transform = f.skewX ? `skewX(${f.skewX}deg)` : 'none';
    f.copies.forEach((c, i) => {
      const st = copies[i].style;
      st.opacity = String(c.opacity);
      st.transform = `translate(${c.dx}px, ${c.dy}px)`;
      if (c.clip) st.clipPath = `inset(${c.clip.top}% 0 ${100 - c.clip.bottom}% 0)`;
    });
  };
  return timedText(33, draw, () => draw(0));
}
