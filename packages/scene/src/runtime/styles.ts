/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */


export function getStylesText(): string {
  return [
    ':host { position: relative; display: flex !important; overflow: hidden; width: 100%; height: 100%; background: var(--oim-bg, transparent); user-select: none; -webkit-user-select: none; content-visibility: auto; contain-intrinsic-size: auto 300px; }',
    ':host(.oim-player-paused) { pointer-events: none !important; }',
    ':host(.oim-player-paused[activate-on="hover"]) { pointer-events: auto !important; }',
    ':host(.oim-player-paused) * { animation-play-state: paused !important; transition: none !important; }',
    // The entrance fade is exempt: paused at its first frame it is opacity 0,
    // and a player that went quiet before the fade ended (off screen, hidden
    // tab) kept its layers invisible. More specific than the rule above, so
    // it wins between two !important declarations.
    ':host(.oim-align-center) { align-items: center; justify-content: center; }',
    ':host(.oim-align-top) { align-items: flex-start; justify-content: center; }',
    ':host(.oim-align-bottom) { align-items: flex-end; justify-content: center; }',
    ':host(.oim-mobile), :host(.oim-tier-low) { --oim-reveal-blur: 0px; }',
    '.oim-player-viewport { position: relative; aspect-ratio: var(--oim-ar, 16/9); flex-shrink: 0; opacity: 0; overflow: hidden; transition: opacity var(--oim-reveal-duration, 0.32s) ease-in-out, filter var(--oim-reveal-duration, 0.32s) ease-in-out; filter: blur(var(--oim-reveal-blur, 14px)); }',
    '.oim-player-viewport.oim-viewport--ready { opacity: 1; filter: none; }',
    // A poster is the base picture on its own: shown at once, the scene held back until ready.
    '.oim-player-viewport.oim-viewport--poster { opacity: 1; filter: none; }',
    '.oim-player-viewport.oim-viewport--poster:not(.oim-viewport--ready) .oim-layer-overlay { visibility: hidden; }',
    '.oim-player-base.oim-base--faded { opacity: 0; transition: opacity 200ms ease-out; }',
    '.oim-player-viewport.oim-fit-contain { max-width: 100%; max-height: 100%; }',
    '.oim-player-viewport.oim-fit-cover { min-width: 100%; min-height: 100%; max-width: none; max-height: none; }',
    '.oim-player-base { display: block; width: 100%; height: 100%; object-fit: fill; pointer-events: none; transition: filter 0.5s ease-in-out; image-rendering: high-quality; image-rendering: -webkit-optimize-contrast; }',
    '.oim-layer-overlay { position: absolute; top: 50%; left: 50%; width: var(--oim-overlay-w, 1080px); height: var(--oim-overlay-h, 1920px); transform: translate(-50%, -50%) scale(var(--oim-fit, 1)); transform-origin: center center; z-index: 10; pointer-events: none; transition: opacity 0.5s ease-in-out; container-type: inline-size !important; container-name: oim-viewport; }',
    // The overlay lets the pointer reach the base picture; each painted layer takes it back (a layer's own inline style still wins).
    '.oim-layer-overlay [data-oim-id] { pointer-events: auto; }',
    '.oim-player-loading { color: var(--oim-text-muted, #8a8a96); font-family: "JetBrains Mono", monospace; font-size: 12px; }',
    '.oim-player-error { color: var(--oim-red, #ef4444); font-family: "JetBrains Mono", monospace; font-size: 12px; }',
  ].join('\n');
}

export function injectStyles(rootNode: ShadowRoot | Document | null): void {
  if (!rootNode) return;
  const cssText = getStylesText();

  if (document.head && !document.getElementById('oim-player-styles')) {
    const globalStyle = document.createElement('style');
    globalStyle.id = 'oim-player-styles';
    globalStyle.textContent = cssText;
    document.head.appendChild(globalStyle);
  }

  if (rootNode.getElementById && !rootNode.getElementById('oim-player-styles')) {
    const shadowStyle = document.createElement('style');
    shadowStyle.id = 'oim-player-styles';
    shadowStyle.textContent = cssText;
    rootNode.appendChild(shadowStyle);
  }
}
