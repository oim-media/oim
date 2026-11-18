/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { presetCss } from '../blocks/presets.js';

export function getStylesText(): string {
  return [
    ':host { position: relative; display: flex !important; overflow: hidden; width: 100%; height: 100%; background: var(--oim-bg, transparent); user-select: none; content-visibility: auto; contain-intrinsic-size: auto 300px; }',
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
    '.oim-player-viewport:not(.oim-viewport--ready) .oim-slot { transition: none !important; }',
    // A poster is the base picture on its own: shown at once, the scene held back until ready.
    '.oim-player-viewport.oim-viewport--poster { opacity: 1; filter: none; }',
    '.oim-player-viewport.oim-viewport--poster:not(.oim-viewport--ready) .oim-layer-overlay { visibility: hidden; }',
    '.oim-player-base.oim-base--faded { opacity: 0; transition: opacity 200ms ease-out; }',
    '.oim-player-viewport.oim-fit-contain { max-width: 100%; max-height: 100%; }',
    '.oim-player-viewport.oim-fit-cover { min-width: 100%; min-height: 100%; max-width: none; max-height: none; }',
    '.oim-player-base { display: block; width: 100%; height: 100%; object-fit: fill; pointer-events: none; transition: filter 0.5s ease-in-out; image-rendering: high-quality; image-rendering: -webkit-optimize-contrast; }',
    '.oim-layer-overlay { position: absolute; top: 50%; left: 50%; width: var(--oim-overlay-w, 1080px); height: var(--oim-overlay-h, 1920px); transform: translate(-50%, -50%) scale(var(--oim-fit, 1)); transform-origin: center center; z-index: 10; pointer-events: none; transition: opacity 0.5s ease-in-out; container-type: inline-size !important; container-name: oim-viewport; }',
    '.oim-slot { position: absolute; pointer-events: auto; white-space: pre-wrap !important; overflow-wrap: break-word !important; word-break: break-word; width: max-content; padding: 0 0.25em 0 0 !important; text-align: center; transform: translate(calc(var(--oim-tx, -50%) + var(--oim-px, 0px)), calc(var(--oim-ty, -50%) + var(--oim-py, 0px))) rotate(var(--oim-rot, 0deg)) scale(var(--oim-scale, 1)); transition: transform var(--oim-transition-duration, 0.2s) cubic-bezier(0.16, 1, 0.3, 1), text-shadow var(--oim-transition-duration, 0.2s) ease, opacity var(--oim-transition-duration, 0.3s) ease; box-sizing: content-box !important; user-select: none; -webkit-user-select: none; }',
    '.oim-slot[data-oim-passthrough] { pointer-events: none !important; }',
    '.oim-slot:hover { transform: translate(calc(var(--oim-tx, -50%) + var(--oim-px, 0px)), calc(var(--oim-ty, -50%) + var(--oim-py, 0px))) rotate(var(--oim-rot, 0deg)) scale(calc(var(--oim-scale, 1) * var(--oim-slot-hover-scale, 1))) !important; }',
    '.oim-slot-link { color: inherit; text-decoration: none; display: inline-block; width: 100%; height: 100%; cursor: pointer; }',
    '.oim-slot-element { transform-origin: center center; white-space: nowrap !important; width: max-content !important; }',
    '.oim-player-loading { color: var(--oim-text-muted, #8a8a96); font-family: "JetBrains Mono", monospace; font-size: 12px; }',
    '.oim-player-error { color: var(--oim-red, #ef4444); font-family: "JetBrains Mono", monospace; font-size: 12px; }',
    '.oim-slot-loop-wrap { display: inline-block; width: 100%; height: auto; transform-origin: center center; }',
    '.oim-slot-hover-wrap { display: inline-block; width: 100%; height: auto; transform-origin: center center; transition: transform 0.2s ease-in-out, text-shadow 0.2s ease-in-out, filter 0.2s ease-in-out; }',
    ...presetCss(),
    // A one-colour pattern with a colour role: the tile is an alpha mask tinted by a CSS variable (core/patternPaint.ts).
    '.oim-pat-dyn::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-color: var(--oim-pat-fg); -webkit-mask-image: var(--oim-pat-mask); mask-image: var(--oim-pat-mask); -webkit-mask-size: var(--oim-pat-size, var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px)); mask-size: var(--oim-pat-size, var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px)); -webkit-mask-repeat: var(--oim-pat-repeat, repeat); mask-repeat: var(--oim-pat-repeat, repeat); -webkit-mask-position: var(--oim-pat-pos, 0 0); mask-position: var(--oim-pat-pos, 0 0); animation: inherit; }',
    '@keyframes background-animation-right { from { background-position: 0 0; -webkit-mask-position: 0 0; mask-position: 0 0; } to { background-position: var(--oim-bg-tile, 160px) 0; -webkit-mask-position: var(--oim-bg-tile, 160px) 0; mask-position: var(--oim-bg-tile, 160px) 0; } }',
    '@keyframes background-animation-left { from { background-position: 0 0; -webkit-mask-position: 0 0; mask-position: 0 0; } to { background-position: calc(-1 * var(--oim-bg-tile, 160px)) 0; -webkit-mask-position: calc(-1 * var(--oim-bg-tile, 160px)) 0; mask-position: calc(-1 * var(--oim-bg-tile, 160px)) 0; } }',
    '@keyframes background-animation-up { from { background-position: 0 0; -webkit-mask-position: 0 0; mask-position: 0 0; } to { background-position: 0 calc(-1 * var(--oim-bg-tile, 160px)); -webkit-mask-position: 0 calc(-1 * var(--oim-bg-tile, 160px)); mask-position: 0 calc(-1 * var(--oim-bg-tile, 160px)); } }',
    '@keyframes background-animation-down { from { background-position: 0 0; -webkit-mask-position: 0 0; mask-position: 0 0; } to { background-position: 0 var(--oim-bg-tile, 160px); -webkit-mask-position: 0 var(--oim-bg-tile, 160px); mask-position: 0 var(--oim-bg-tile, 160px); } }',
    '@keyframes background-animation-zoom-in { 0%, 100% { background-size: var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px); -webkit-mask-size: var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px); mask-size: var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px); } 50% { background-size: calc(var(--oim-bg-tile, 160px) * 1.15) calc(var(--oim-bg-tile, 160px) * 1.15); -webkit-mask-size: calc(var(--oim-bg-tile, 160px) * 1.15) calc(var(--oim-bg-tile, 160px) * 1.15); mask-size: calc(var(--oim-bg-tile, 160px) * 1.15) calc(var(--oim-bg-tile, 160px) * 1.15); } }',
    '@keyframes background-animation-zoom-out { 0%, 100% { background-size: calc(var(--oim-bg-tile, 160px) * 1.15) calc(var(--oim-bg-tile, 160px) * 1.15); -webkit-mask-size: calc(var(--oim-bg-tile, 160px) * 1.15) calc(var(--oim-bg-tile, 160px) * 1.15); mask-size: calc(var(--oim-bg-tile, 160px) * 1.15) calc(var(--oim-bg-tile, 160px) * 1.15); } 50% { background-size: var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px); -webkit-mask-size: var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px); mask-size: var(--oim-bg-tile, 160px) var(--oim-bg-tile, 160px); } }',
    '@keyframes background-animation-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.65; } }',
    '@keyframes background-animation-none { }',
    '[data-slot-id="background-pattern-slot"] { width: 100% !important; height: 100% !important; display: block !important; }'
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
