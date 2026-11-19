/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The player around the picture: its state, its motion policy and what a screen reader
// hears. The layers are painted by the scene (`@oim-media/scene`); nothing here paints.

import type { DeviceProfile } from '../../../scene/src/runtime/device-tier.js';
import { a11yNodes, artworkLabel } from '../../../scene/src/runtime/a11y.js';
import type { Layer, OimDocument } from '../../../core/src/v2/schema.js';

export interface ImageEngineOptions {
  allowZoom?: boolean;
  showLanguageSelector?: boolean;
  showSlots?: boolean;
  allowLottie?: boolean;
  allowDynamicColors?: boolean;
  disableAnimations?: boolean;
  disableActions?: boolean;
  dropdownBlur?: boolean;
  fit?: 'contain' | 'cover';
  align?: 'center' | 'top' | 'bottom';
  poster?: 'auto' | 'only';
}

export function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** A 2.0 layer as the screen-reader reading takes it: its box's corner, its words, its alt. */
function a11ySlots(layers: Layer[], isHidden: (id: string) => boolean, out: object[] = []): object[] {
  for (const l of layers) {
    out.push({
      id: l.id,
      type: l.type,
      position: [l.box?.x ?? 0, l.box?.y ?? 0],
      content: l.text?.content,
      isInteractive: !!l.interactions?.length,
      style: { isVisible: !isHidden(l.id), alt: l.a11y?.alt, decorative: l.a11y?.decorative, marks: (l.text as { marks?: unknown } | undefined)?.marks },
    });
    if (l.children) a11ySlots(l.children, isHidden, out);
  }
  return out;
}

export class EngineShell {
  updateScale(): void {}
  updateViewportSize(): void {}
  /** The scene is up and the viewport revealed. A player may act on it (a poster fades out). */
  protected sceneReady(): void {}

  host!: HTMLElement;
  /** `only`: the base picture alone; no scene is mounted. */
  poster: 'auto' | 'only' = 'auto';
  /** The file as verified (1.x or 2.0). */
  metadata: any = null;
  /** The 2.0 document the scene paints, once it is up. */
  _doc: OimDocument | null = null;
  /** File trust state: no_metadata | unsigned | verified | invalid_signature | corrupt */
  securityStatus: string = 'unsigned';
  imageUrl: string | null = null;
  lang!: string;
  showControls!: boolean;
  zoom = 1;
  panX = 0;
  panY = 0;
  _stage: HTMLElement | null = null;
  _viewport: HTMLElement | null = null;
  _baseImg: HTMLImageElement | null = null;
  _overlay: HTMLElement | null = null;
  /** The drag listeners on `window`, so they can be removed on destroy. */
  _onDragMove: ((e: MouseEvent) => void) | null = null;
  _onDragEnd: (() => void) | null = null;
  _paused = false;
  _resizeObserver: ResizeObserver | null = null;
  _onFullscreenChange: (() => void) | null = null;
  _retryViewportSize = false;

  allowZoom!: boolean;
  showLanguageSelector!: boolean;
  showSlots!: boolean;
  allowLottie!: boolean;
  allowDynamicColors: boolean = true;
  disableAnimations!: boolean;
  disableActions!: boolean;
  dropdownBlur!: boolean;
  fit!: 'contain' | 'cover';
  align!: 'center' | 'top' | 'bottom';
  _deviceProfile!: DeviceProfile;

  /**
   * A player its page asked to keep still: animations off AND the element says
   * so (`disable-animations`, or `mode="image"`). play() then starts nothing.
   */
  _isStill(): boolean {
    const host = this.host as any;
    if (!this.disableAnimations || !host || typeof host.getAttribute !== 'function') return false;
    const attr = host.getAttribute('disable-animations');
    return (attr !== null && attr !== 'false') || host.getAttribute('mode') === 'image';
  }

  _isLowTierOrMobile(): boolean {
    const host = this.host as any;
    if (host && typeof host.getAttribute === 'function') {
      const attrTier = host.getAttribute('tier') || host.getAttribute('quality');
      if (attrTier === 'low') return true;
      if (attrTier === 'high') return false;
    }
    return this._deviceProfile.isMobile || this._deviceProfile.tier === 'low';
  }

  _prefersLessMotion(): boolean {
    try {
      return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  /**
   * The reading a screen reader gets: a figure named after the work, and a hidden box with
   * its words, described images and buttons in visual order. Built from the document; a
   * layer the scene marks hidden (`data-oim-hidden`) is read as hidden.
   */
  _buildA11y(): void {
    const viewport = this._viewport;
    const doc = this._doc;
    if (!viewport || !doc) return;
    const principal = doc.languages?.[0] || this.lang;
    const overlay = this._overlay;
    const nodeOf = (id: string) => overlay?.querySelector('[data-oim-id="' + CSS.escape(id) + '"]') as HTMLElement | null;
    const isHidden = (id: string) => !!nodeOf(id)?.hasAttribute('data-oim-hidden');
    const nodes = a11yNodes(a11ySlots(doc.layers, isHidden) as never, this.lang, principal, !this.disableActions);
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    viewport.setAttribute('role', 'figure');
    viewport.setAttribute('aria-label', artworkLabel(doc as { description?: Record<string, string> }, nodes, this.lang, principal));
    let box = viewport.querySelector('.oim-a11y') as HTMLElement | null;
    if (!box) {
      box = document.createElement('div');
      box.className = 'oim-a11y';
      box.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
      viewport.appendChild(box);
    }
    box.textContent = '';
    for (const n of nodes) {
      let el: HTMLElement;
      if (n.type === 'text') {
        el = document.createElement('p');
        el.setAttribute('lang', n.lang);
        el.textContent = n.text;
      } else if (n.type === 'image') {
        el = document.createElement('span');
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', n.label);
      } else {
        el = document.createElement('button');
        el.setAttribute('type', 'button');
        el.textContent = n.label;
        // Same action as clicking the painted layer: forward the click to it.
        const fire = () => nodeOf(n.slotId)?.click();
        el.addEventListener('click', fire);
        // preventDefault stops the browser's own synthetic click, so Enter fires once.
        el.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
        });
      }
      box.appendChild(el);
    }
  }
}
