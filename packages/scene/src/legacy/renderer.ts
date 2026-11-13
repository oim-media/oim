/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The painting half of the 1.x player engine, moved here unchanged. The player's
// ImageEngine extends it with loading, verification and the viewport.
import { setFlag } from './attrs.js';
import { playerString } from './strings.js';
import { getDeviceProfile, type DeviceProfile } from './device-tier.js';
import { injectStyles } from './styles.js';
import { renderMarkedText, plainOf, type Marks } from './marked-text.js';
import { dropCapStyle, splitDropCap } from '../../../core/src/drop-cap.js';
import { layerTextureMask } from '../../../core/src/effects/texture-mask.js';
import { isEntranceEffect, entranceUnits, entranceStart, entranceKeyframes, entranceClips, ENTRANCE_SECONDS, type EntranceEffect } from '../../../core/src/text-effects.js';
import { loadLottie } from './lottie-loader.js';
import { v2LayersOf, anchorShift, paintColors, typographyCss } from './v2-layers.js';
import { paintCss } from '../../../core/src/v2/paint-css.js';
import { sanitizeHtml, sanitizeFontFamily, isSandboxImageSrc } from './sanitize.js';
import {
  computeLayerComposition,
  getFilterCss,
  getMaskPathData,
  getMaskClipPathD,
  getMaskSilhouettePath,
  getWindowMaskCanvasD,
  getMaskSilhouetteCanvasD,
  getMaskClipPathId,
  getMaskFeatherId,
  getDuotoneFilterId,
  DUOTONE_COLORS,
  type CompositionNode,
  type Slot as CompositionSlot
} from './layerComposition.js';
import {
  buildWaveKeyframesCss,
  waveCharAnimationDelay,
  WAVE_PERIOD_SECONDS,
  WAVE_KEYFRAMES_NAME,
} from './waveText.js';
import { calculateGlitchState, glitchLayers } from '../../../core/src/glitch.js';
import { easingToCss, revealFrames, revealTiming } from '../../../core/src/reveal.js';
import { calculateTypewriterState } from './typewriterText.js';
import { getFillCss, patternLayerCss, shapeMaskCss, svgSilhouetteMaskCss } from '../../../core/src/fill.js';
import { paintPattern } from './patternPaint.js';
import { resolveCssColor, resolvePalette, DYNAMIC_COLOR_ROLES } from '../../../core/src/dynamic-colors.js';
import { applyTrimToSvgPaths, ensureTrimKeyframes } from './trimPath.js';
import { ParallaxController } from './ParallaxController.js';
import { oversizeScale } from '../../../core/src/oversize.js';
import { shapeDrawing } from '../../../core/src/geoShapes.js';
import { frameSilhouette } from '../../../core/src/frame-silhouette.js';
import { mediaFilterCss } from '../../../core/src/media-filters.js';
import { buildSvgNoiseFilter, buildLayerGrainFilter, GRAIN_LAYER_TYPES } from '../../../core/src/generative/proceduralNoise.js';
import { TEXTURE_CATALOG, type TexturePreset } from '../../../core/src/effects/index.js';
import { infiniteLayerPlan, TRACK_CLASS, LEGACY_TRACK_CLASS, ensureParallaxKeyframes, type InfiniteLayer } from '../../../core/src/parallaxCss.js';
import { localizedEntries, isImageContent, compareLangs } from './localizedEntries.js';
import { a11yNodes, artworkLabel } from './a11y.js';
import { dropShadowCss, shadowColorCss, shadowFollowsGlyphs } from './shadow.js';
import { cropCss } from '../../../core/src/crop.js';
import { mountImageFill } from './image-fill.js';
import { flipScale } from '../../../core/src/flip.js';
import { isGroup, childrenByGroup, wrapperStyle } from './groups.js';
import { resolveLineHeight, inkMargin } from '../../../core/src/typography.js';
import { resolveDimensionToCss, resolveNumericDimension } from '../../../core/src/dimensions.js';
import { slotClipping } from '../../../core/src/clipping.js';
import { whatTheReaderCannotDo, describeMissing, CONTRACT_VERSION, PLAYER_CAPABILITIES } from '../../../core/src/compatibility.js';
import { bindStates, resolveActions, applyMinHitArea, readInteraction, type ActionRunner, type RegisterOutsideTap } from './states.js';
import { resolveMode } from './modes.js';
import { buildArtisticTextModelFromSlot, generateArtisticTextSvgString } from './artisticText.js';
import { readEmbeddedFonts, registerEmbeddedFonts, embeddedFontFamily } from './embeddedFonts.js';

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
 * Entrance text effects (fade-chars, slide-up, bounce-chars): one span per
 * unit with a CSS animation whose keyframes are sampled from @oim-media/core, so the
 * editor and the player draw the same curve. It plays once and stays still;
 * the host's `oim-player-paused` class pauses it like any CSS animation.
 */
export function applyEntranceText(el: HTMLElement, text: string, effect: EntranceEffect, speed?: number, delay?: number): void {
  el.textContent = '';
  entranceUnits(text, effect).forEach((unit, i) => {
    if (/^\s+$/.test(unit)) {
      el.appendChild(document.createTextNode(unit));
      return;
    }
    const span = document.createElement('span');
    span.textContent = unit;
    span.className = 'oim-entrance';
    const st = span.style;
    st.display = 'inline-block';
    st.animation = `oim-entrance-${effect} ${ENTRANCE_SECONDS}s linear ${entranceStart(i, speed, delay)}s both`;
    if (!entranceClips(effect)) {
      el.appendChild(span);
      return;
    }
    // A rectangular clip of the word's own box: the word rises into view.
    const clip = document.createElement('span');
    clip.className = 'oim-entrance-clip';
    clip.style.display = 'inline-block';
    clip.style.overflow = 'hidden';
    clip.style.verticalAlign = 'top';
    clip.appendChild(span);
    el.appendChild(clip);
  });
}

/** The entrance keyframes, once per shadow root and effect; still with reduced motion. */
export function ensureEntranceKeyframes(shadowRoot: ShadowRoot | null, effect: EntranceEffect): void {
  if (!shadowRoot) return;
  const id = 'oim-entrance-' + effect;
  if (shadowRoot.getElementById(id)) return;
  const frames = entranceKeyframes(effect);
  const rotates = frames.some((f) => f.rotateDeg !== 0);
  const css = frames.map((f, i) => `${(i * 100) / (frames.length - 1)}%{opacity:${f.opacity};transform:translateY(${f.translateYEm}em) scale(${f.scale})${rotates ? ` rotate(${f.rotateDeg}deg)` : ''}}`).join('');
  const el = document.createElement('style');
  el.id = id;
  el.textContent = `@keyframes ${id}{${css}}@media (prefers-reduced-motion: reduce){.oim-entrance{animation:none!important}}`;
  shadowRoot.appendChild(el);
}

/** Injects the wave @keyframes only once per shadow root. The rule is
 *  identical for all slots, so it is not duplicated per slot. */
export function ensureWaveKeyframes(shadowRoot: ShadowRoot | null): void {
  if (!shadowRoot) return;
  const styleId = 'oim-wave-keyframes';
  if (shadowRoot.getElementById(styleId)) return;
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = buildWaveKeyframesCss();
  shadowRoot.appendChild(styleEl);
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

export function applyTextHighlight(el: HTMLElement, hl?: any): void {
  if (!hl?.enabled) return;
  const c = hl.color || 'rgba(245,158,11,.35)', m = hl.style === 'underline-thick', st = el.style;
  st.backgroundColor = m ? 'transparent' : c;
  if (m) st.boxShadow = `inset 0 -.4em 0 ${c}`;
  st.borderRadius = hl.style === 'pill' ? '9999px' : hl.style === 'box' ? '0' : `${hl.borderRadius ?? 3}px`;
  st.padding = `${hl.paddingY ?? 2}px ${hl.paddingX ?? 4}px`;
  st.boxDecorationBreak = (st as any).webkitBoxDecorationBreak = 'clone';
}

/**
 * The drop cap: the big first letter, then the rest of the text WITH its marks
 * (`text` is the stored text, tags and escapes included).
 */
export function applyDropCap(el: HTMLElement, text: string, dc?: any, marks?: Marks): boolean {
  if (!dc?.enabled || !text) return false;
  const { letter, rest } = splitDropCap(text, Object.keys(marks ?? {}));
  if (!letter) return false;
  const s = document.createElement('span'), st = s.style;
  // One style for the three renderers (@oim-media/core drop-cap.ts).
  const d = dropCapStyle(dc);
  s.textContent = letter;
  st.float = 'left';
  st.fontSize = `${d.scale}em`;
  st.lineHeight = String(d.lineHeight);
  st.marginRight = `${d.marginRight}px`;
  if (d.fontFamily) st.fontFamily = d.fontFamily;
  if (d.color) st.color = d.color;
  st.fontWeight = String(d.fontWeight);
  st.userSelect = 'none';
  renderMarkedText(el, rest, marks);
  el.prepend(s);
  return true;
}

interface LottieAnimation {
  goToAndStop: (frame: number, isFrame: boolean) => void;
  play: () => void;
  pause: () => void;
  destroy: () => void;
}

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
}

export function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function hexChannel(hex: string, channelIndex: 0 | 1 | 2): number {
  const clean = (hex || '').replace('#', '');
  const value = parseInt(clean.substring(channelIndex * 2, channelIndex * 2 + 2), 16) || 0;
  return Math.round((value / 255) * 1000) / 1000;
}

// Mirrors the editor's <LayerCompositionDefs> (React/JSX) 1:1, but built with
// document.createElementNS since this package has no JSX. Only invoked when
// at least one mask or duotone-filter slot exists, so projects using neither
// feature never get this extra <svg> node in their output.
/**
 * Frame of a dedicated mask in "window" mode.
 *
 * Twin of the editor's equivalent block. The first <path> holds the
 * full-coverage rectangle plus the silhouette, and `fill-rule="evenodd"`
 * subtracts one from the other: the frame is painted and the hole stays
 * transparent. The second outlines the die-cut when requested.
 */
function buildWindowMaskSvg(slot: any, artboard: { width: number; height: number }): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const style = slot.style || {};
  const W = artboard.width;
  const H = artboard.height;

  const pos = Array.isArray(slot.position) ? slot.position : [0, 0];
  const x = typeof slot.x === 'number' ? slot.x : (Number(pos[0]) / 100) * W;
  const y = typeof slot.y === 'number' ? slot.y : (Number(pos[1]) / 100) * H;

  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('preserveAspectRatio', 'none');

  // The frame lives in CANVAS coordinates, not in the slot's box.
  //
  // It used to be `width/height: 100%` inside the slot, which is a flex container
  // with align-items/justify-content meant for text: the SVG did not fill the
  // slot and ended up centered, leaving a strip of the canvas uncovered at the top
  // (measured in the real viewer: 22.4px). Also, the frame could only cover what
  // the mask measured. Taking it out of the flow with position:absolute decouples it
  // from the text layout, and anchoring it at (-x, -y) puts it at the canvas origin.
  svg.style.position = 'absolute';
  svg.style.left = (-x) + 'px';
  svg.style.top = (-y) + 'px';
  svg.style.width = W + 'px';
  svg.style.height = H + 'px';
  svg.style.flex = 'none';
  svg.style.overflow = 'visible';
  svg.style.display = 'block';
  svg.style.pointerEvents = 'none';

  const frameBox = document.createElementNS(svgNs, 'path');
  frameBox.setAttribute('d', getWindowMaskCanvasD(slot, artboard));
  frameBox.setAttribute('fill', resolveCssColor(style.maskBgColorRole || style.fillColorRole, style.maskBgColor || '#38BDF8'));
  frameBox.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(frameBox);

  const thickness = style.maskStrokeWidth ?? 0;
  if (thickness > 0) {
    const border = document.createElementNS(svgNs, 'path');
    border.setAttribute('d', getMaskSilhouetteCanvasD(slot, artboard));
    border.setAttribute('fill', 'none');
    border.setAttribute('stroke', resolveCssColor(style.maskStrokeColorRole || style.strokeColorRole, style.maskStrokeColor || '#FFFFFF'));
    border.setAttribute('stroke-width', String(thickness));
    border.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(border);
  }

  return svg;
}

/**
 * Mask SVG definitions, in canvas coordinates.
 *
 * Twin of the editor's LayerCompositionDefs. The key choice is
 * `userSpaceOnUse`: `objectBoundingBox` stretched the silhouette over the
 * clipped layer's box and ignored the mask's own geometry.
 */
function buildLayerCompositionDefs(
  slots: CompositionSlot[],
  artboard: { width: number; height: number }
): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('style', 'position:absolute');
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(svgNs, 'defs');
  svg.appendChild(defs);

  slots.forEach(function (s) {
    const style = s.style || {};
    if (s.type === 'mask' && style.maskMode === 'cutout') {
      const feather = style.maskFeather;
      const d = getMaskClipPathD(s, artboard);

      if (feather && feather > 0) {
        const filterId = getMaskFeatherId(s) + '-blur';

        const filter = document.createElementNS(svgNs, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', String(artboard.width));
        filter.setAttribute('height', String(artboard.height));
        const blur = document.createElementNS(svgNs, 'feGaussianBlur');
        blur.setAttribute('stdDeviation', String(feather));
        filter.appendChild(blur);
        defs.appendChild(filter);

        const mask = document.createElementNS(svgNs, 'mask');
        mask.setAttribute('id', getMaskFeatherId(s));
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        const bgRect = document.createElementNS(svgNs, 'rect');
        bgRect.setAttribute('x', '0');
        bgRect.setAttribute('y', '0');
        bgRect.setAttribute('width', String(artboard.width));
        bgRect.setAttribute('height', String(artboard.height));
        bgRect.setAttribute('fill', 'black');
        mask.appendChild(bgRect);

        const g = document.createElementNS(svgNs, 'g');
        g.setAttribute('filter', 'url(#' + filterId + ')');
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'white');
        path.setAttribute('clip-rule', 'evenodd');
        path.setAttribute('fill-rule', 'evenodd');
        g.appendChild(path);
        mask.appendChild(g);
        defs.appendChild(mask);
      } else {
        const clip = document.createElementNS(svgNs, 'clipPath');
        clip.setAttribute('id', getMaskClipPathId(s));
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('d', d);
        // Always evenodd: the three subpaths (canvas, box and silhouette) require
        // it. It no longer depends on maskInvert or maskMode.
        path.setAttribute('clip-rule', 'evenodd');
        clip.appendChild(path);
        defs.appendChild(clip);
      }
    }
    if (s.type === 'filter' && style.filterPreset === 'duotone') {
      const filter = document.createElementNS(svgNs, 'filter');
      filter.setAttribute('id', getDuotoneFilterId(s));
      const colorMatrix = document.createElementNS(svgNs, 'feColorMatrix');
      colorMatrix.setAttribute('type', 'matrix');
      colorMatrix.setAttribute('values', '0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0');
      filter.appendChild(colorMatrix);
      const transfer = document.createElementNS(svgNs, 'feComponentTransfer');
      (['R', 'G', 'B'] as const).forEach(function (ch, idx) {
        const func = document.createElementNS(svgNs, 'feFunc' + ch);
        func.setAttribute('type', 'table');
        const channelIndex = idx as 0 | 1 | 2;
        func.setAttribute('tableValues', hexChannel(DUOTONE_COLORS.shadows, channelIndex) + ' ' + hexChannel(DUOTONE_COLORS.lights, channelIndex));
        transfer.appendChild(func);
      });
      filter.appendChild(transfer);
      defs.appendChild(filter);
    }
  });

  return svg;
}


function normalizePosition(position: [number, number]): [number, number] {
  let x = position[0];
  let y = position[1];
  if (x > 1 || y > 1) {
    x = x / 100;
    y = y / 100;
  }
  return [x, y];
}

/**
 * Decides whether the background SVG is painted as a repeated tile or as a
 * full-bleed scene.
 *
 * `tile` is the historical behaviour and MUST remain the default: .oim files exported
 * before the generative engine carry no `backgroundFit`, and they are all repeating
 * icon patterns. Changing the default
 * would break any file already published.
 *
 * `backgroundType === 'generative'` infers `cover` as a safety net for
 * files baked by an editor version that did not yet write the field.
 */
export function resolveBackgroundFit(style: any): 'tile' | 'cover' {
  if (!style) return 'tile';
  if (style.backgroundFit === 'cover' || style.backgroundFit === 'tile') {
    return style.backgroundFit;
  }
  return style.backgroundType === 'generative' ? 'cover' : 'tile';
}

/**
 * Attaches one composition node (and its subtree) to `target`.
 *
 * Extracted out of `renderSlots` verbatim so the `results` -> `elByCompositionId`
 * -> attach path can be exercised in isolation. The invariant that matters, and that has
 * no other guard: in a project that uses NEITHER masks NOR filters, the children appended
 * to the fragment must match the input slot list one-to-one and in the same order.
 * A restructuring once silently dropped zone-less slots from the DOM, and only human
 * review caught it.
 */
export function attachCompositionNode(
  node: CompositionNode,
  target: DocumentFragment | HTMLElement,
  elByCompositionId: Map<string, HTMLElement>
): void {
  const el = elByCompositionId.get(node.shape.id);
  if (!el) return;
  if (node.clipPath) el.style.clipPath = node.clipPath;
  if (node.maskStyle) el.style.mask = node.maskStyle;
  target.appendChild(el);
}

/** Longest the first reveal waits for layer media before lifting the veil. */
const REVEAL_MEDIA_CAP_MS = 1200;

export class LegacyRenderer {
  /** The viewport is the player's; the renderer asks it to resize after painting. */
  updateScale(): void {}
  updateViewportSize(): void {}
  host!: HTMLElement;
  metadata: any = null;
  /** File trust state: no_metadata | unsigned | verified | invalid_signature | corrupt */
  securityStatus: string = 'unsigned';
  /** Family -> internal name of the fonts shipped inside this file. */
  embeddedFontFamilies: Map<string, string> = new Map();
  imageUrl: string | null = null;
  lang!: string;
  showControls!: boolean;
  activeSlotId: string | null = null;
  zoom = 1;
  panX = 0;
  panY = 0;
  _stage: HTMLElement | null = null;
  _viewport: HTMLElement | null = null;
  _baseImg: HTMLImageElement | null = null;
  _overlay: HTMLElement | null = null;
  _lottieInstances: Array<{ slotId: string; inst: LottieAnimation }> = [];
  /** The live controller. It is kept so it can be destroyed and repointed. */
  _parallaxController: ParallaxController | null = null;
  /** The drag listeners on `window`, so they can be removed on destroy. */
  _onDragMove: ((e: MouseEvent) => void) | null = null;
  _onDragEnd: (() => void) | null = null;
  _animations: Animation[] = [];
  _textAnimations: TimedTextAnimation[] = [];
  /**
   * Whether the player is paused. Keyframe animations run through the Web
   * Animations API, which the `oim-player-paused` class (CSS
   * `animation-play-state`) does not reach: they are paused here by hand, and
   * one created while paused starts paused.
   */
  _paused = false;
  /** Show/hide animations in flight, one per slot element. */
  _revealAnims = new Map<HTMLElement, Animation>();
  /** Each slot's keyframe timeline, for the `play` action. */
  _timelines = new Map<string, Animation>();
  _warnedPlay = new Set<string>();
  _heldTimelines = new Set<Animation>();

  /**
   * A player its page asked to keep still: animations off AND the element says
   * so (`disable-animations`, or `mode="image"`). The one rule for "no motion
   * work at all": the infinite loop and the parallax controller both read it,
   * so they cannot disagree.
   */
  _isStill(): boolean {
    const host = this.host as any;
    if (!this.disableAnimations || !host || typeof host.getAttribute !== 'function') return false;
    const attr = host.getAttribute('disable-animations');
    return (attr !== null && attr !== 'false') || host.getAttribute('mode') === 'image';
  }
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
   * Writes `--oim-palette-<role>` in the viewer with the effective palette: the
   * `palette` attribute, otherwise dark/light according to prefers-color-scheme, otherwise
   * defaultPalette. With allow-dynamic-colors="false" it writes none.
   */
  applyPalette(): void {
    const viewport = this._viewport as HTMLElement | null;
    if (!viewport) return;
    const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    const palette = this.allowDynamicColors
      ? resolvePalette(this.metadata ?? {}, { requested: this.host.getAttribute('palette'), prefersDark })
      : null;
    for (const role of DYNAMIC_COLOR_ROLES) {
      const value = palette?.colors[role];
      if (value) viewport.style.setProperty('--oim-palette-' + role, value);
      else viewport.style.removeProperty('--oim-palette-' + role);
    }
  }

  async renderSlots(options?: { onlyIds?: Set<string> }): Promise<void> {
    if (!this.metadata || !this.host) return;

    const allSlots = (this.metadata.slots || this.metadata.elements || []) as any[];
    // The composition (masks and filters) is computed over the whole stack, so
    // it does not admit patches: if there is one, everything is rebuilt.
    const hasComposition = allSlots.some(function (s: any) {
      return s.type === 'mask' || s.type === 'filter';
    });
    const partial = !!(options && options.onlyIds && options.onlyIds.size > 0) && !hasComposition;
    const onlyIds = partial ? options!.onlyIds! : null;

    // The veil only covers the FIRST build. Once the image has been shown,
    // dropping it again would flash the whole image out and back; a language
    // switch brings its own blur (_switchWithBlur).
    if (this._viewport && !this._revealed) {
      this._viewport.classList.remove('oim-viewport--ready');
    }
    if (!this.showSlots) {
      if (this._overlay) {
        this._overlay.innerHTML = '';
      }
      if (this._viewport) {
        this._viewport.classList.add('oim-viewport--ready');
      }
      return;
    }

    if (onlyIds) {
      this._destroyLottiesIn(onlyIds);
    } else if (this._lottieInstances) {
      this._lottieInstances.forEach(function (reg) {
        try { reg.inst.destroy(); } catch (e) {}
      });
      this._lottieInstances = [];
    }

    const layer = this._overlay;
    if (!layer) return;

    // Texture overlay on the canvas (metadata.effects or metadata.grain)
    const existingGrain = this._viewport ? this._viewport.querySelector('.oim-noise-overlay') : null;
    const canvasTextureEff = Array.isArray(this.metadata?.effects)
      ? this.metadata.effects.find((e: any) => e && e.type === 'texture' && e.enabled !== false)
      : null;

    if (canvasTextureEff) {
      const texDef = TEXTURE_CATALOG[canvasTextureEff.preset as TexturePreset];
      if (texDef) {
        const grainEl = (existingGrain as HTMLElement) || document.createElement('div');
        grainEl.className = 'oim-noise-overlay';
        grainEl.style.position = 'absolute';
        grainEl.style.inset = '0';
        grainEl.style.width = '100%';
        grainEl.style.height = '100%';
        grainEl.style.pointerEvents = 'none';
        grainEl.style.mixBlendMode = canvasTextureEff.blend || texDef.defaultBlend || 'overlay';
        const opacityVal = (canvasTextureEff.intensity !== undefined ? canvasTextureEff.intensity : texDef.defaultIntensity) / 100;
        grainEl.style.opacity = opacityVal.toFixed(2);
        grainEl.style.zIndex = '999';
        const scale = canvasTextureEff.scale || 1.0;
        const w = texDef.tileWidth * scale;
        const h = texDef.tileHeight * scale;
        grainEl.style.backgroundImage = `url("${texDef.getDataUri(canvasTextureEff.color)}")`;
        grainEl.style.backgroundRepeat = 'repeat';
        grainEl.style.backgroundSize = `${w}px ${h}px`;
        if (!existingGrain && this._viewport) {
          this._viewport.appendChild(grainEl);
        }
      }
    } else if (this.metadata && this.metadata.grain && this.metadata.grain.enabled) {
      const g = this.metadata.grain;
      const intensity = g.intensity ?? 15;
      const blendMode = g.blendMode ?? 'overlay';
      const baseFreq = g.baseFrequency ?? 0.8;
      const grainEl = (existingGrain as HTMLElement) || document.createElement('div');
      grainEl.className = 'oim-noise-overlay';
      grainEl.style.position = 'absolute';
      grainEl.style.inset = '0';
      grainEl.style.width = '100%';
      grainEl.style.height = '100%';
      grainEl.style.pointerEvents = 'none';
      grainEl.style.mixBlendMode = blendMode;
      grainEl.style.opacity = (intensity / 100).toFixed(2);
      grainEl.style.zIndex = '999';

      const filterId = 'oim-global-noise-filter';
      // g.color (optional) tints the grain; the core validates it before it
      // reaches the SVG, and without it the grain is the usual grey.
      const svgFilter = buildSvgNoiseFilter(filterId, { intensity, baseFrequency: baseFreq, color: g.color });
      const svgDataUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs>${svgFilter}</defs><rect width="100%" height="100%" filter="url(#${filterId})"/></svg>`
      );
      grainEl.style.backgroundImage = `url("${svgDataUri}")`;

      if (!existingGrain && this._viewport) {
        this._viewport.appendChild(grainEl);
      }
    } else if (existingGrain) {
      existingGrain.remove();
    }


    const self = this;
    const slots = this.metadata.slots || this.metadata.elements || [];
    // Parallax normalization: if it travels inside style and the root lacks it, copy it to the root.
    // A single entry point so that the whole engine and controllers read from s.parallax.
    slots.forEach(function (s: any) {
      if (s && !s.parallax && s.style && s.style.parallax) {
        s.parallax = s.style.parallax;
      }
    });
    const fontPromises: Promise<void>[] = [];
    const canvasWidth = (self.metadata && (self.metadata.artboardWidth || self.metadata.canvasWidth || self.metadata.canvas_width)) || ((self.metadata && self.metadata.canvas) ? (self.metadata.canvas.natural_width || self.metadata.canvas.width) : 0);
    const baseWidth = canvasWidth || (self._baseImg && self._baseImg.naturalWidth > 0 ? self._baseImg.naturalWidth : 1080);
    const canvasHeight = (self.metadata && (self.metadata.artboardHeight || self.metadata.canvasHeight || self.metadata.canvas_height)) || ((self.metadata && self.metadata.canvas) ? (self.metadata.canvas.natural_height || self.metadata.canvas.height) : 0);
    const baseHeight = canvasHeight || (self._baseImg && self._baseImg.naturalHeight > 0 
      ? Math.round(baseWidth * (self._baseImg.naturalHeight / self._baseImg.naturalWidth))
      : 1920);

    layer.style.setProperty('--oim-overlay-w', baseWidth + 'px');
    layer.style.setProperty('--oim-overlay-h', baseHeight + 'px');

    function scaleValue(val: any): any {
      return val;
    }

    const fragment = document.createDocumentFragment();

    const zonesMap: Record<string, HTMLElement> = {};
    const zonesList = this.metadata.zones || [];
    zonesList.forEach((zone: any) => {
      const zoneDiv = document.createElement('div');
      zoneDiv.className = 'oim-zone';
      zoneDiv.id = 'oim-zone-' + zone.id;
      
      const pos = zone.position || [0, 0];
      const size = zone.size || [100, 100];
      
      zoneDiv.style.position = 'absolute';
      zoneDiv.style.left = pos[0] + '%';
      zoneDiv.style.top = pos[1] + '%';
      zoneDiv.style.width = size[0] + '%';
      zoneDiv.style.height = size[1] + '%';
      zoneDiv.style.boxSizing = 'border-box';
      
      const zoneStyle = zone.style || {};
      const display = zoneStyle.display || 'flex';
      zoneDiv.style.display = display;
      if (display === 'flex') {
        zoneDiv.style.flexDirection = zoneStyle.flexDirection || 'column';
        zoneDiv.style.justifyContent = zoneStyle.justifyContent || 'flex-start';
        zoneDiv.style.alignItems = zoneStyle.alignItems || 'flex-start';
        zoneDiv.style.gap = scaleValue(zoneStyle.gap || '8px');
      }
      
      if (zoneStyle.background) zoneDiv.style.background = zoneStyle.background;
      if (zoneStyle.padding) zoneDiv.style.padding = scaleValue(zoneStyle.padding);
      if (zoneStyle.borderRadius) zoneDiv.style.borderRadius = scaleValue(zoneStyle.borderRadius);
      if (zoneStyle.backdropFilter) {
        zoneDiv.style.backdropFilter = zoneStyle.backdropFilter;
        (zoneDiv.style as any).webkitBackdropFilter = zoneStyle.backdropFilter;
      }
      
      fragment.appendChild(zoneDiv);
      zonesMap[zone.id] = zoneDiv;
    });

    // Which groups have children IN THIS file. It is computed before building
    // any element because it decides whether the group comes to exist in the DOM:
    // a group without children is not painted, as is the case today.
    const groupChildren = childrenByGroup(slots);

    // The 2.0 reading of this file; the blocks already migrated are painted from it.
    const v2Layers = v2LayersOf(self.metadata);
    const v2Colors = paintColors(self.metadata);

    const slotPromises = slots.map(async (slot: any) => {
      const slotType = slot.type;
      if (onlyIds && !onlyIds.has(String(slot.id))) return null;
      // Short aliases (st, p, t, c) retired in 1.12.0: one name per concept,
      // one reading of a file (no writer ever emitted them).
      const style = slot.style || {};
      const position = slot.position;
      const tracking_data = slot.tracking_data;

      // Mask and filter slots are pure composition directives: computeLayerComposition
      // turns them into a clipPath on their predecessor / a wrapping filter group, and
      // never emits a node that would render the slot itself. Building an element for
      // them would be dead work whose side effects survive (per-slot dynamic <style>
      // injections, lottie instances and image fetches bound to a permanently detached
      // node), so bail before any of that happens. They still reach the composition
      // step, which reads them straight from the raw `slots` metadata array.
      // `isMaskLayer` disappeared when the mask was turned into its own type.
      // A mask in die-cut mode only clips: it emits no visible node. The one in
      // window mode IS painted (it is the frame), and that is why it is outside this
      // guard.
      if (slotType === 'mask' && style.maskMode === 'cutout') {
        // ...but composition only runs over the TOP-LEVEL stack: `compositionSlots`
        // below filters out zone-assigned slots. So a mask/filter placed inside a
        // zone neither renders (this return) nor clips (never reaches the tree) —
        // it just ceases to exist. Unsupported, and previously with no diagnostic.
        const _zoneId = slot.zone_id || slot.z;
        if (_zoneId && zonesMap[_zoneId]) {
          console.warn(
            '[OimPlayer] Slot "' + slot.id + '" is a mask layer inside zone "' + _zoneId +
            '". Mask layers are only supported in the top-level slot stack, so this one will neither render ' +
            'nor clip anything. Move it out of the zone.'
          );
        }
        return null;
      }

      const localized = localizedEntries(slot, self.lang);
      let rawText = localized.content;
      // Pure geometric shapes and filter layers carry no text content but
      // still render from their style (fillColor, geoShape, width/height, backdropFilter).
      // The dedicated mask in "window" mode is a layer that gets painted: a
      // In image mode NOTHING is interactive, so it is cut off here and not further
      // down: this flag also decides the minimum contact area and the
      // sizing. A slot that cannot be clicked needs neither of those
      // things.
      const isInteractiveSlot = !self.disableActions
        && (slot.isInteractive === true || style.isInteractive === true || Boolean(slot.states || style.states));
      const isWindowMask = slotType === 'mask' && style.maskMode !== 'cutout';
      const isArtisticText = slotType === 'artistic-text';
      const isGeoLike = slotType === 'geo' || slotType === 'shape' || slotType === 'draw' || slotType === 'filter' || slotType === 'container' || isWindowMask || isInteractiveSlot || isArtisticText;

      // A group WITH children does produce an element: it is the phase 3 wrapper.
      //
      // Until now the group never arrived: `group` is not in `isGeoLike`, so a slot
      // without text was discarded on this line and the player painted nothing.
      // The group's dead weight was in the SIGNED FILE, not in the DOM; the design
      // diagnosis said the opposite,
      // and this was verified here.
      //
      // The condition is «has children» and not «is a group», because this way the files
      // older than phase 3, which carry no `style.groupId` on any slot,
      // produce EXACTLY the same DOM as today: with no children to nest, the
      // wrapper would have nothing inside and would just be one extra layer.
      const isBackgroundSlot = slot.is_background_pattern === true || slot.id === 'background-pattern-slot';
      const isWrapperWithChildren = slotType === 'group' && groupChildren.has(String(slot.id));
      if (isWrapperWithChildren) {
        // Falls straight into building the element, skipping the guard below:
        // a wrapper has no content of its own to show.
      } else if (slotType === 'pattern' || isBackgroundSlot) {
        // Falls straight into building the element: a pattern or background layer does not
        // carry `content`; its CSS comes from `patternLayerCss` or `isBackgroundSlot` further down.
      } else if (!rawText && !(isGeoLike && (style.fillColor || style.fillType || style.width || slotType === 'filter' || slotType === 'container' || isWindowMask || isInteractiveSlot || isArtisticText))) return null;

      const isImageSlot = isImageContent(slot, rawText);

      // Inline <svg> tags in content are always allowed (local shapes);
      // external URLs are no longer loaded: the player only accepts `data:`.
      let text = rawText;
      let isSvg = false;

      if (isImageSlot) {
        // rawText is the image source; resolved below in the image branch
      } else {
        if (/&lt;svg|&lt;span|&lt;div|&lt;a|&lt;img/i.test(text)) {
          text = text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        }
        isSvg = /<svg/i.test(text);
      }

      const hasHtmlOrSvg = !isImageSlot && (isSvg || /<span|<div|<a|<img/i.test(text));
      text = text.replace(/\\n/g, '\n');

      if (isSvg) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const svgElements = doc.querySelectorAll('svg');
          svgElements.forEach(function (svgEl) {
            // Force the SVG to fill its slot via the viewBox instead of its
            // intrinsic pixel width/height. Keeping an explicit width like
            // "541.52" would render at intrinsic size and get clipped by the
            // slot's overflow:hidden (only a corner shows). The viewBox +
            // preserveAspectRatio drive proportional scaling, 1:1 with the editor.
            if (!svgEl.getAttribute('viewBox')) {
              const w0 = svgEl.getAttribute('width');
              const h0 = svgEl.getAttribute('height');
              if (w0 && h0) svgEl.setAttribute('viewBox', '0 0 ' + parseFloat(w0) + ' ' + parseFloat(h0));
            }
            svgEl.setAttribute('width', '100%');
            svgEl.setAttribute('height', '100%');
            if (!svgEl.getAttribute('preserveAspectRatio')) {
              svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
            const resolvedStroke = resolveCssColor(style.strokeColorRole, style.strokeColor);
            const resolvedFill = resolveCssColor(style.fillColorRole, style.fillColor);
            if (resolvedStroke) {
              svgEl.style.color = resolvedStroke;
            }
            // With `setProperty`, not by concatenating the `style` attribute. That colour
            // comes from the .oim and the schema does NOT validate it, so pasted into the
            // attribute the browser parses it as a list of declarations: a `strokeColor` of
            // "red; background-image: url(https://…)" let a request to a third party
            // through when a foreign file was opened. The CSSOM rejects the whole value if
            // it is not a valid colour -- checked in the browser.
            // Via the attribute it injects; via CSSOM it does not.
            //
            // The `color` assignment above was already safe; this line overwrote it and
            // reintroduced the hole.
            svgEl.style.setProperty('display', 'block');
            svgEl.style.setProperty('width', '100%');
            svgEl.style.setProperty('height', '100%');
            
            const shapes = svgEl.querySelectorAll('path, circle, rect, polygon, polyline, ellipse, line');
            shapes.forEach(function (shape) {
              const fill = shape.getAttribute('fill');
              const stroke = shape.getAttribute('stroke');

              // CSSOM, not the attribute: a role colour is a var(), which SVG
              // attributes do not take (the icon kept its fixed colour).
              if (resolvedStroke && (stroke === 'currentColor' || stroke === '')) {
                (shape as SVGElement).style.setProperty('stroke', resolvedStroke);
              } else if (stroke && (stroke === 'currentColor' || stroke === '')) {
                shape.setAttribute('stroke', 'currentColor');
              }

              if (resolvedFill && resolvedFill !== 'transparent') {
                (shape as SVGElement).style.setProperty('fill', resolvedFill);
              } else if (fill && (fill === 'currentColor' || fill === '')) {
                if (resolvedStroke) {
                  (shape as SVGElement).style.setProperty('fill', resolvedStroke);
                } else {
                  shape.setAttribute('fill', 'currentColor');
                }
              }

              // NOTE: never force `vector-effect: non-scaling-stroke`. SVGs whose
              // artwork is drawn with thick viewBox-unit strokes (e.g. the OIM
              // logo, stroke-width 120 in a 541 viewBox) would render the stroke
              // at raw screen px and blot out the whole slot. Letting strokes
              // scale with the shape matches the editor 1:1.
            });
          });
          text = doc.body.innerHTML.replace(/\\n/g, '\n');
        } catch (e) {
          console.warn('[OimPlayer] Failed to parse SVG, using raw text:', e);
        }
      }

      const maxWidth = localized.maxWidthValue;
      const textAlign = style.textAlign || slot.align || 'left';
      let alignItems = 'center';
      if (textAlign === 'left') alignItems = 'flex-start';
      else if (textAlign === 'right') alignItems = 'flex-end';

      let slotEl: HTMLElement = document.createElement('div');
      slotEl.className = 'oim-slot';
      slotEl.setAttribute('part', 'slot');
      slotEl.setAttribute('data-slot-id', slot.id);

      // Selective visibility by language (languages rule: ["*"] | ["es", ...])
      if (Array.isArray(slot.languages) && !slot.languages.includes('*') && !slot.languages.includes(self.lang)) {
        slotEl.style.display = 'none';
      }

      // Visual layer effects (neon glow)
      if (style.effect === 'neon') {
        const neonColor = resolveCssColor(style.effectColorRole, style.effectColor || '#f59e0b');
        const r = typeof style.effectRadius === 'number' ? style.effectRadius : 16;
        slotEl.style.filter = 'drop-shadow(0 0 ' + (r * 0.4) + 'px ' + neonColor + ') drop-shadow(0 0 ' + r + 'px ' + neonColor + ')';
      }

      // Background layer slots (editor's dynamic pattern) must paint BEHIND the
      // rest regardless of their position in the slots array.
      slotEl.style.zIndex = isBackgroundSlot ? '0' : '1';
      (slotEl as any)._oimReveal = style.reveal;
      // A layer with no interaction of its own lets the pointer through: a
      // text above a card, or a full-canvas group revealed by a click, used to
      // swallow the hover or click of the layer behind it. A CSS rule
      // (styles.ts), so show/hide cannot undo it.
      if (!isInteractiveSlot && !(slot.interaction && !self.disableActions)) {
        slotEl.setAttribute('data-oim-passthrough', '');
      }
      if (isBackgroundSlot) {
        slotEl.style.pointerEvents = 'none';

        // 1:1 with the editor: the pattern is a repeating SVG tile
        // (160px * scale in design px) animated via background-position.
        const tileSvg = style.svgRawXml || (isSvg ? text : '');
        if (tileSvg || style.backgroundPatternType || style.backgroundPatternSvgs) {
          paintPattern(slotEl, style, tileSvg);

          const fitMode = resolveBackgroundFit(style);
          if (fitMode === 'cover') {
            slotEl.style.backgroundSize = 'cover';
            slotEl.style.backgroundRepeat = 'no-repeat';
            slotEl.style.backgroundPosition = 'center';
            slotEl.style.setProperty('--oim-pat-size', 'cover');
            slotEl.style.setProperty('--oim-pat-repeat', 'no-repeat');
            slotEl.style.setProperty('--oim-pat-pos', 'center');
          } else {
            const patternScale = parseFloat(style.backgroundPatternScale) || 1;
            const tileCqw = (160 * patternScale / baseWidth) * 100;
            slotEl.style.backgroundSize = tileCqw.toFixed(4) + 'cqw ' + tileCqw.toFixed(4) + 'cqw';
            slotEl.style.backgroundRepeat = 'repeat';
            slotEl.style.setProperty('--oim-bg-tile', tileCqw.toFixed(4) + 'cqw');
          }

          let bgAnimation = style.cssAnimation;
          if (!bgAnimation && (style.backgroundPatternSpeed || style.backgroundPatternDirection)) {
            const dir = style.backgroundPatternDirection || 'right';
            const speed = style.backgroundPatternSpeed || 8;
            bgAnimation = `background-animation-${dir} ${speed}s linear infinite`;
          }
          if (!self.disableAnimations && typeof bgAnimation === 'string' && bgAnimation.indexOf('background-animation-') === 0) {
            slotEl.style.animation = bgAnimation;
          }
          // The tile paints via background — don't also inject the SVG inline.
          text = '';
          isSvg = false;
        }
      }

      // `pattern` layer: tiled and moved, with the CSS computed by the core.
      // NOT the canvas background (`isBackgroundSlot`, above): that mark
      // stretches to 100% of the viewer, and a pattern layer has its own
      // position and size. The player does not compute this CSS on its own: the
      // only thing it does is apply it exactly as `patternLayerCss` returns it.
      if (slotType === 'pattern') {
        const patternCss = patternLayerCss(style);
        for (const [prop, value] of Object.entries(patternCss)) {
          if (prop.startsWith('--')) {
            slotEl.style.setProperty(prop, value);
          } else {
            (slotEl.style as any)[prop] = value;
          }
        }
        if (style.fillPatternColorRole || style.fillPatternBgColorRole) {
          paintPattern(slotEl, style, '');
        }
      }

      const loopWrap = document.createElement('div');
      loopWrap.className = 'oim-slot-loop-wrap';

      const hoverWrap = document.createElement('div');
      hoverWrap.className = 'oim-slot-hover-wrap';

      // Inline SVG / image / lottie fill their slot box; the wrappers default to
      // height:auto, which breaks the child's height:100% (it would fall back to
      // the viewBox aspect and overflow). Force the wrappers to fill height.
      if (isSvg || isImageSlot || slotType === 'lottie' || isArtisticText) {
        loopWrap.style.height = '100%';
        hoverWrap.style.height = '100%';
      }

      let textFill: Record<string, string> | null = null;
      const v2TextFills = slotType === 'text' ? v2Layers.get(String(slot.id))?.fills : undefined;
      const v2TextFill = v2TextFills?.length === 1 ? v2TextFills[0] : undefined;
      if (v2TextFill) {
        const css = paintCss(v2TextFill, { colors: v2Colors, isText: true, width: slot.width_px || baseWidth, height: slot.height_px || baseHeight });
        textFill = Object.keys(css).length > 0 ? (css as Record<string, string>) : null;
      } else if (slotType === 'text' && style.fillType && style.fillType !== 'none') {
        textFill = getFillCss({
          type: 'text',
          width: slot.width_px || baseWidth,
          height: slot.height_px || baseHeight,
          fillType: style.fillType,
          fillColor: resolveCssColor(style.fillColorRole || style.colorRole, style.fillColor),
          fillGradient: style.fillGradient,
          fillGenerative: style.fillGenerative,
          fillPatternType: style.fillPatternType,
          fillPatternColor: style.fillPatternColor,
          fillPatternBgColor: style.fillPatternBgColor,
          fillPatternSpeed: style.fillPatternSpeed,
          fillPatternScale: style.fillPatternScale,
        });
      }

      const isMaskFill = textFill !== null && (textFill.backgroundClip === 'text' || (textFill as any).webkitBackgroundClip === 'text');
      // loopWrap with position: absolute is only valid when the slot has defined dimensions;
      // otherwise, width: max-content and height: auto would collapse with content out of flow.
      const hasDefinedSize = Boolean(style.width && style.height);
      const useWrapMask = isMaskFill && hasDefinedSize;

      if (isImageSlot) {
        let imgSrc = text.trim();
        if (imgSrc.startsWith('<')) {
          const match = imgSrc.match(/src=["']([^"']+)["']/);
          if (match && match[1]) {
            imgSrc = match[1];
          }
        }
        
        // Sandbox: only an image that travels inside the file is painted. A
        // network URL would be a tracking pixel -it tells the author who opened
        // the work-, so it is refused even when it points at our own hosts.
        const isSafeSrc = isSandboxImageSrc(imgSrc);
        
        const imgEl = document.createElement('img');
        if (isSafeSrc) {
          imgEl.src = imgSrc;
        } else {
          console.warn('[OimPlayer] Image not embedded in the file (network URLs are not loaded), slot:', slot.id);
          imgEl.src = '';
        }
        imgEl.alt = '';
        imgEl.draggable = false;
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        // 'cover' is the EDITOR's default when creating an image figure. This
        // default only applies to old files: until `serializeSlots` was fixed,
        // `objectFit` did not travel to the .oim, so the viewer fell back to
        // here and drew 'contain' where the editor showed 'cover'. New files carry
        // the explicit value and do not depend on this line; matching the editor
        // also aligns the already exported ones.
        imgEl.style.objectFit = style.objectFit || 'cover';
        // Contract 1.15.0: a crop frames and zooms the image over "cover"; its
        // wrapper clips the overflow. Without one, nothing changes.
        if (style.imageCrop) {
          const c = cropCss(style.imageCrop);
          imgEl.style.objectFit = c.objectFit;
          imgEl.style.objectPosition = c.objectPosition;
          imgEl.style.transform = c.transform;
          imgEl.style.transformOrigin = c.transformOrigin;
          hoverWrap.style.overflow = 'hidden';
        }
        imgEl.style.display = 'block';
        imgEl.style.pointerEvents = 'none';
        // Contract 1.18.0: only an image layer's picture takes the filter; a
        // non-image slot whose content is a data:image must not get it.
        imgEl.style.filter = slot.type === 'image' ? (mediaFilterCss(style) ?? '') : '';
        
        loopWrap.style.width = '100%';
        loopWrap.style.height = '100%';
        hoverWrap.style.width = '100%';
        hoverWrap.style.height = '100%';

        imgEl.onerror = function (err) {
          console.error('[OimPlayer] Image slot failed to load for slot:', slot.id, 'error:', err);
          imgEl.style.display = 'none';
        };
        hoverWrap.appendChild(imgEl);
      } else if (slotType === 'lottie') {
        const lottieContainer = document.createElement('div');
        lottieContainer.className = 'oim-lottie-container';
        lottieContainer.style.width = '100%';
        lottieContainer.style.height = '100%';
        hoverWrap.appendChild(lottieContainer);
        
        if (!self.allowLottie) {
          console.warn(`[OIM Player] Lottie animation slot ${slot.id} detected but allowLottie option is false. Hiding dynamic element.`);
          slotEl.style.display = 'none';
        } else {
          // lottie_light: no expression engine and no eval(). The player renders
          // third-party Lottie JSON, so the full build (eval over embedded
          // expressions) would be an XSS path. In the CDN build it is not in the
          // bundle at all: loadLottie() fetches it as a separate file.
          loadLottie().then(function (lottie) {
            const isUrl = typeof text === 'string' && (text.startsWith('http') || text.endsWith('.json') || text.trim().indexOf('{') !== 0);
            if (isUrl) {
              console.warn('[OimPlayer] Lottie animation must be a valid JSON string. External URLs are not supported.');
              return;
            }
            const anim = lottie.loadAnimation({
              container: lottieContainer,
              renderer: 'svg',
              loop: !self.disableAnimations,
              // The library loads late: a player paused meanwhile (a card
              // waiting for the cursor) must not get a Lottie that plays.
              autoplay: !self.disableAnimations && !self._paused,
              path: isUrl ? text.trim() : undefined,
              animationData: !isUrl ? JSON.parse(text) : undefined
            }) as LottieAnimation;
            if (self.disableAnimations) {
              anim.goToAndStop(0, true);
            }
            self._lottieInstances.push({ slotId: String(slot.id), inst: anim });
          }).catch(function (err) {
            console.error('[OIM Player] Error loading local Lottie bundle. Hiding dynamic element:', err);
            slotEl.style.display = 'none';
          });
        }
      } else if (isArtisticText) {
        loopWrap.style.width = '100%';
        loopWrap.style.height = '100%';
        hoverWrap.style.width = '100%';
        hoverWrap.style.height = '100%';
        hoverWrap.style.display = 'flex';
        hoverWrap.style.alignItems = 'center';
        hoverWrap.style.justifyContent = 'center';
        hoverWrap.style.pointerEvents = 'none';

        const model = buildArtisticTextModelFromSlot(slot, self.lang, baseWidth);
        // The SVG appends ", sans-serif" itself; the embedded name goes first.
        const embeddedArtistic = embeddedFontFamily(model.fontFamily, self.embeddedFontFamilies);
        if (embeddedArtistic) model.fontFamily = embeddedArtistic.replace(/, sans-serif$/, '');
        const svgMarkup = generateArtisticTextSvgString(model, String(slot.id));
        if (typeof DOMParser !== 'undefined') {
          const tempDoc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
          const svgEl = tempDoc.documentElement;
          if (svgEl) {
            hoverWrap.appendChild(svgEl);
          }
        } else {
          hoverWrap.innerHTML = svgMarkup;
        }
      } else if (hasHtmlOrSvg) {
        let textTarget: HTMLElement = hoverWrap;
        if (useWrapMask) {
          const textContainer = document.createElement('div');
          textContainer.className = 'oim-slot-text';
          hoverWrap.appendChild(textContainer);
          textTarget = textContainer;
        }
        const safeHtml = sanitizeHtml(text);
        if (typeof DOMParser !== 'undefined') {
          const tempDoc = new DOMParser().parseFromString(safeHtml, 'text/html');
          while (tempDoc.body.firstChild) {
            textTarget.appendChild(tempDoc.body.firstChild);
          }
        } else {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = safeHtml;
          while (tempDiv.firstChild) {
            textTarget.appendChild(tempDiv.firstChild);
          }
        }
      } else {
        // Careful: this branch is the `else` of the sanitized-HTML path, so a
        // text slot authored with rich HTML/SVG renders WITHOUT the wave even though
        // it has textAnimationType === 'wave-chars' (deliberate: we do not split
        // arbitrary HTML character by character).
        let textTarget: HTMLElement = hoverWrap;
        if (useWrapMask) {
          const textContainer = document.createElement('div');
          textContainer.className = 'oim-slot-text';
          hoverWrap.appendChild(textContainer);
          textTarget = textContainer;
        }

        const animType = style.textAnimationType;
        applyTextHighlight(textTarget, (style as any).textHighlight);
        // Text marks (contract 1.11.0): what cannot hold marks (animations,
        // the drop cap) gets the plain text, never the tags.
        const marks = (style as any).marks;
        const plain = plainOf(text, marks);

        if (animType === 'wave-chars' && !self.disableAnimations) {
          ensureWaveKeyframes(self.host.shadowRoot);
          applyWaveText(
            textTarget,
            plain,
            typeof style.textAnimationSpeed === 'number' ? style.textAnimationSpeed : 0.05,
            typeof style.textAnimationDelay === 'number' ? style.textAnimationDelay : 0
          );
        } else if (isEntranceEffect(animType) && !self.disableAnimations) {
          ensureEntranceKeyframes(self.host.shadowRoot, animType);
          applyEntranceText(textTarget, plain, animType, style.textAnimationSpeed, style.textAnimationDelay);
        } else if (animType === 'typewriter' && !self.disableAnimations) {
          self._bornPausedIfNeeded(self._textAnimations, applyTypewriterText(textTarget, plain, style.textAnimationSpeed, style.textAnimationDelay, (style as any).typewriterCursor));
        } else if (animType?.startsWith('glitch-') && !self.disableAnimations) {
          self._bornPausedIfNeeded(self._textAnimations, applyGlitchText(textTarget, plain, animType as any, style.textAnimationSpeed, style.textAnimationDelay, (style as any).textAnimationIntensity));
        } else if (!applyDropCap(textTarget, text, (style as any).dropCap, marks)) {
          renderMarkedText(textTarget, text, marks);
        }
      }
 
      loopWrap.appendChild(hoverWrap);

      // Infinite parallax: if the layer moves in a loop, wrap it in the track
      // with 2 copies per infiniteLayerPlan. It is only duplicated if it moves (duplicate: true).
      const parallaxCfg = slot.parallax || style.parallax;
      let duplicatedForInfinite = false;

      if (parallaxCfg && parallaxCfg.enabled) {
        const inf = parallaxCfg.infinite || {};

        // A loop that is OFF is zero speed, not the default speed.
        //
        // `parallaxCfg.enabled` says the LAYER has parallax; `inf.enabled`
        // says whether that layer moves in a loop. They are different things and both must be
        // checked: a layer with parallax and the loop off (the mountain and the
        // cabin still in front of the moving sky) arrived here with its `speedPxSec` intact and
        // ended up duplicated and scrolling.
        //
        // It is the central rule of the design ("only what moves is duplicated"),
        // broken by the reader. No test could see it: the pure generator tests receive the
        // speed already calculated, and nothing covered the stretch that translates the file's
        // configuration into that speed.
        const loopDisabled = inf.enabled === false || self._isStill();

        const speedPxSec = loopDisabled ? 0 : parallaxCfg.speedPxSec !== undefined
          ? parallaxCfg.speedPxSec
          : (inf.speedPxSec !== undefined
            ? inf.speedPxSec
            : (inf.speed_px_sec !== undefined
              ? inf.speed_px_sec
              : (parallaxCfg.mode === 'infinite_horizontal' ? (parallaxCfg.speed !== undefined ? parallaxCfg.speed : 20) : 0)));

        const direction = (parallaxCfg.direction || inf.direction || 'right_to_left') as 'left_to_right' | 'right_to_left';

        const mirror = parallaxCfg.mirror !== undefined
          ? !!parallaxCfg.mirror
          : (parallaxCfg.seamlessTile !== undefined
            ? !!parallaxCfg.seamlessTile
            : (inf.mirror !== undefined
              ? !!inf.mirror
              : (inf.seamlessTile !== undefined
                ? !!inf.seamlessTile
                : (inf.seamless_tile !== undefined ? !!inf.seamless_tile : true))));

        const pauseOnHover = parallaxCfg.pauseOnHover !== undefined
          ? !!parallaxCfg.pauseOnHover
          : (inf.pauseOnHover !== undefined
            ? !!inf.pauseOnHover
            : !!inf.pause_on_hover);

        const layerCfg: InfiniteLayer = {
          speedPxSec: Number(speedPxSec) || 0,
          direction: direction,
          mirror: mirror,
          pauseOnHover: pauseOnHover,
        };

        const slotW = slot.width_px || (slot.widthPercent ? (slot.widthPercent / 100) * baseWidth : (style.width ? (parseFloat(style.width) / 100) * baseWidth : baseWidth));
        // The canvas WIDTH goes too: it decides how many pieces are needed so that the
        // track covers it for the whole loop. Without it, a layer narrower than the canvas
        // leaves empty bands at the sides.
        const plan = infiniteLayerPlan(layerCfg, slotW || baseWidth, baseWidth);

        if (plan.duplicate) {
          duplicatedForInfinite = true;
          ensureParallaxKeyframes(self.host.shadowRoot);

          const track = document.createElement('div');
          track.className = `${TRACK_CLASS} ${LEGACY_TRACK_CLASS}`;
          for (const [k, v] of Object.entries(plan.container)) {
            track.style.setProperty(k, v);
          }

          // How many pieces and which are mirrored is decided by the PLAN. With mirroring
          // there are four (A, mirror(A), A, mirror(A)) because the offset is
          // -50% of the track: with only two, at the end of the loop mirror(A) shows where A began
          // and the reset JUMPS.
          for (let i = 0; i < plan.copies; i++) {
            const piece = (i === 0 ? loopWrap : loopWrap.cloneNode(true)) as HTMLElement;
            // The width is decided by the plan, not by this file: the track is
            // `width: max-content` and a piece with a percentage width would
            // collapse, leaving them overlapping.
            for (const [k, v] of Object.entries(plan.copy)) {
              piece.style.setProperty(k, v);
            }
            if (i % 2 === 1) {
              for (const [k, v] of Object.entries(plan.secondCopy)) {
                piece.style.setProperty(k, v);
              }
            }
            track.appendChild(piece);
          }
          slotEl.appendChild(track);
        }
      }

      if (!duplicatedForInfinite) {
        slotEl.appendChild(loopWrap);
      }

      // Trim path: if the slot has trimStart/trimEnd, apply stroke-dasharray
      // to the inline SVG <path>s once they are mounted in the DOM.
      // `trimDuration` goes in the condition on purpose: an icon with
      // trimStart 0 and trimEnd 100 trims nothing, but IS animated, and it is the
      // most common case: drawing the whole icon from start to finish.
      if (hasHtmlOrSvg && (style.trimStart || (style.trimEnd != null && style.trimEnd < 100) || style.trimDuration)) {
        if (style.trimDuration) ensureTrimKeyframes(self.host.shadowRoot);
        applyTrimToSvgPaths(hoverWrap, style);
      }
      
      // A text's typography comes from its 2.0 layer; what it leaves out keeps the defaults.
      const v2Typo = slotType === 'text' ? typographyCss(v2Layers.get(String(slot.id)), self.lang) : undefined;
      const lineHeightSource = v2Typo ? { lineHeight: v2Layers.get(String(slot.id))?.text?.lineHeight } : style;
      const fontSize: string = v2Typo?.fontSize ?? localized.size;
      const fontFamily = v2Typo ? v2Typo.fontFamily : style.fontFamily;
      // Only layers that paint text need a font. serializeSlots writes
      // fontFamily "Inter" on EVERY layer, images included, so without this
      // any .oim with an image asked Google for Inter when opened.
      const paintsText = isArtisticText || (!isImageSlot && !isSvg && slotType !== 'lottie' && text.trim() !== '');
      if (fontFamily && paintsText) {
        const safeFontFamily = sanitizeFontFamily(fontFamily);
        // Sandbox: the editor ships the fonts inside the file. A family that
        // did not travel falls back to whatever the viewer has installed; it is
        // never fetched, because a request to a font host reveals who is looking.
        const embedded = embeddedFontFamily(safeFontFamily, self.embeddedFontFamilies);
        slotEl.style.setProperty('font-family', embedded || safeFontFamily);
      }
 
      if (duplicatedForInfinite) alignItems = 'flex-start';
      else if (textAlign === 'left') alignItems = 'flex-start';
      else if (textAlign === 'right') alignItems = 'flex-end';
      else alignItems = 'center';
 
      slotEl.style.maxWidth = v2Typo?.maxWidth ?? maxWidth;
      slotEl.style.fontSize = fontSize;
      // Unitless: it is inherited as a factor, so a child with a different font size
      // computes ITS line height and does not drag the parent's along.
      slotEl.style.lineHeight = String(resolveLineHeight(lineHeightSource));
      if (v2Typo) {
        for (const key of ['fontWeight', 'fontStyle', 'letterSpacing', 'textTransform', 'textDecoration'] as const) {
          if (v2Typo[key]) (slotEl.style as any)[key] = v2Typo[key];
        }
      }

      if (slotType === 'svg' || isSvg) {
        const vectorColor = resolveCssColor(style.strokeColorRole || style.fillColorRole, style.strokeColor);
        if (vectorColor) {
          slotEl.style.setProperty('color', vectorColor);
        }
      } else if (slotType === 'text' && (style.fillColor || style.fillColorRole || style.colorRole)) {
        // In a text, `fillColor` IS the letter (contract 1.5.0: `color` was
        // removed and the compiler converts it to `fillColor`). Here `style.color` was
        // being read, so a new text from the editor (`fillColor` with no
        // `fillType`) came out signed without a colour. A fill with a mask
        // (gradient, pattern) overrides it afterwards with `color: transparent`.
        const resolvedTextColor = v2TextFill
          ? ('kind' in v2TextFill && v2TextFill.kind === 'color' ? v2Colors.css(v2TextFill.value) : '')
          : resolveCssColor(style.fillColorRole || style.colorRole, style.fillColor);
        if (resolvedTextColor) {
          slotEl.style.setProperty('color', resolvedTextColor);
        }
      }

      // The text FILL: gradient, pattern or generative background.
      //
      // `getFillCss` already handled text from the start (it returns
      // `background-clip: text` for those three types), but NOBODY called it
      // for a text slot: its only call in the whole monorepo was for
      // `slotType === 'container'`. The branch existed but was unreachable, so no
      // published .oim uses gradient text: it is not that the editor did not offer it,
      // it is that nobody painted it.
      //
      // Phase 3: the mask moves to hoverWrap, inside what animates (loopWrap),
      // so the browser composes them as a single layer instead of recomposing
      // the mask each frame (62.6 fps -> 144.2 fps in 120-text gallery benchmark).
      // Solid fills and auto-sized texts without fixed dimensions keep the mask on slotEl.
      if (textFill) {
        if (useWrapMask) {
          loopWrap.style.position = 'absolute';
          loopWrap.style.top = '0';
          loopWrap.style.left = '0';
          loopWrap.style.right = '0';
          loopWrap.style.bottom = '0';
          loopWrap.style.width = '100%';
          loopWrap.style.height = '100%';

          hoverWrap.style.width = '100%';
          hoverWrap.style.height = '100%';
          hoverWrap.style.boxSizing = 'border-box';
          // Replicates the .oim-slot rule `padding: 0 0.25em 0 0 !important` so the text area stays where it was.
          hoverWrap.style.setProperty('padding-right', '0.25em', 'important');
          hoverWrap.style.display = 'flex';
          hoverWrap.style.flexDirection = 'column';
          hoverWrap.style.justifyContent = 'center';
          hoverWrap.style.alignItems = alignItems;

          Object.assign(hoverWrap.style, textFill);

          // With `background-clip: text` the paint is clipped to the background
          // area, which is the line box. Descender ink (the "j", "p", "g") sticks
          // out of it and is left unfilled, which a text stroke makes obvious.
          // `inkMargin` returns ZERO when the line height already leaves room:
          // growing the area for nothing would shift a vertical gradient.
          //
          // It lives on slotEl (as in origin/main) so slotEl's padding box grows
          // to cover that ink. loopWrap fills that padding box (inset: 0) and
          // hoverWrap bears the mask fill, matching origin/main's background box
          // exactly. `important` because `.oim-slot` declares `padding` with
          // `!important`, and a stylesheet rule beats a plain inline style.
          const inkPad = inkMargin(resolveLineHeight(lineHeightSource));
          if (inkPad > 0) {
            slotEl.style.setProperty('padding-top', inkPad + 'em', 'important');
            slotEl.style.setProperty('padding-bottom', inkPad + 'em', 'important');
          }
        } else {
          Object.assign(slotEl.style, textFill);
          if (isMaskFill) {
            const inkPad = inkMargin(resolveLineHeight(lineHeightSource));
            if (inkPad > 0) {
              slotEl.style.setProperty('padding-top', inkPad + 'em', 'important');
              slotEl.style.setProperty('padding-bottom', inkPad + 'em', 'important');
            }
          }
        }
      }

      slotEl.style.textAlign = textAlign;
      slotEl.style.display = 'flex';
      slotEl.style.flexDirection = 'column';
      slotEl.style.justifyContent = 'center';
      slotEl.style.alignItems = alignItems;
      slotEl.style.opacity = '0';
      slotEl.style.transition = 'opacity 0.3s ease';
      slotEl.style.whiteSpace = 'pre-line';
      slotEl.style.overflow = slotClipping({
        isText: slotType === 'text',
        isParallaxGroup: !!(slot.isParallaxGroup || style.isParallaxGroup || slot.is_parallax_group),
        hasFilterOrShadow: !!(style.filter || style.boxShadow || style.textShadow),
        hasKeyframes: Array.isArray(style.animation?.keyframes) && style.animation.keyframes.length >= 2,
      });
      // Resolve slot width and height based on design proportions
      const origW = self.metadata?.canvas_width || self.metadata?.canvasWidth || (self.metadata?.canvas ? self.metadata.canvas.natural_width : 800);
      const origH = self.metadata?.canvas_height || self.metadata?.canvasHeight || (self.metadata?.canvas ? self.metadata.canvas.natural_height : 600);
      
      let widthCqw = '';
      let heightCqw = '';
      if (slot.width_px && origW) {
        widthCqw = ((slot.width_px / origW) * 100).toFixed(4) + 'cqw';
      } else if (slot.widthPercent) {
        widthCqw = slot.widthPercent + 'cqw';
      }
      if (slot.height_px && origW) {
        heightCqw = ((slot.height_px / origW) * 100).toFixed(4) + 'cqw';
      } else if (slot.heightPercent) {
        heightCqw = slot.heightPercent + 'cqw';
      }

      if (isInteractiveSlot) {
        applyMinHitArea(slotEl);
      }

      const resolvedStyleWidth = resolveDimensionToCss(style.width, origW);
      const resolvedStyleHeight = resolveDimensionToCss(style.height, origH || origW);

      if (resolvedStyleWidth && resolvedStyleHeight) {
        slotEl.style.width = resolvedStyleWidth;
        slotEl.style.height = resolvedStyleHeight;
      } else if (widthCqw && heightCqw && (isGeoLike || isImageSlot || !rawText)) {
        slotEl.style.width = widthCqw;
        slotEl.style.height = heightCqw;
      } else if (isImageSlot) {
        slotEl.style.width = resolvedStyleWidth || '10cqw';
        slotEl.style.height = resolvedStyleHeight || '10cqw';
      } else if ((isGeoLike && !hasHtmlOrSvg && !rawText) || isBackgroundSlot || slotType === 'pattern') {
        // Pure geometric shapes, invisible triggers, and pattern background
        slotEl.style.width = widthCqw || resolvedStyleWidth || '10cqw';
        slotEl.style.height = heightCqw || resolvedStyleHeight || '10cqw';
      } else {
        slotEl.style.width = 'max-content';
        slotEl.style.height = 'auto';
      }

      // Editor shape properties → CSS (borders, fill, and clipPath/shapes)
      // fillColor is the background of the container element.
      // For geo/shape/draw slots it is the intentional fill of the geometric shape.
      // For text, lottie, and image slots, the editor stores a highlight/selection
      // color (rgba(37,99,235,0.15)) that must NOT be rendered — the container
      // background should remain transparent by default.
      // A window-mode mask carries NO background: its colour goes on the SVG frame and
      // the hole must stay transparent so that what is behind shows through.
      // `isGeoLike` answers TWO questions at once ("is a background painted?" and
      // "does it need a box and a contact area?"), and the interactive slots came in under the
      // second. They took the first as a bonus: an interactive TEXT received the colour of its
      // own letter as background, because on a text layer `fillColor` IS the letter's colour.
      // It came out as a solid block with the text inside it:
      // invisible.
      //
      // Found on a real .oim: a button that was red text on white in the editor
      // and a red rectangle in the player. It predates the click hookup (`states` alone
      // was enough, and hover already had them).
      // Complex fills of shapes. Painted on a child layer under the
      // SVG, masked with the shape, so the SVG keeps only the stroke. The mask
      // is on that layer and not on the slot: on the slot it would also cut the
      // outer half of the stroke.
      // Vector layers too, for pattern and generative: the layer is
      // masked with the drawing's silhouette, so the fill follows the icon. A
      // gradient is not here: the editor writes it inside the SVG itself.
      const isVectorFill = (slotType === 'svg' || isSvg) && !isWindowMask && (
        (style.fillType === 'pattern' && !!style.fillPatternType) ||
        (style.fillType === 'generative' && !!style.fillGenerative)
      );
      // A photo that is actually painted covers the slot: a stale fill role must
      // not put its palette colour behind the photo's transparent parts.
      const pictureShown = style.fillType === 'image' && isSandboxImageSrc(String(style.fillImage || '').trim());
      const hasComplexFill = isVectorFill || ((slotType === 'geo' || slotType === 'shape') && !isWindowMask && (
        pictureShown ||
        (style.fillType === 'gradient' && !!style.fillGradient) ||
        (style.fillType === 'pattern' && !!style.fillPatternType) ||
        (style.fillType === 'generative' && !!style.fillGenerative)
      ));
      const resolvedBgColor = resolveCssColor(style.fillColorRole, style.fillColor);
      if (resolvedBgColor && isGeoLike && !isWindowMask && slotType !== 'text' && !isArtisticText && !hasComplexFill) {
        slotEl.style.setProperty('background-color', resolvedBgColor);
      }
      // A window-mode mask has no box border: its outline is
      // `maskStrokeWidth`, traced over the silhouette inside the <svg>. Painting it
      // here drew a rectangle on the slot's edge and, since absolute elements are positioned
      // from the PADDING box, it pushed the frame anchored to the canvas out by the border
      // width: it overflowed at the bottom and
      // on the right, and on neither of the other two sides.
      // NOT on vector layers. An icon carries no box border around it: the editor reads the
      // stroke as the outline of the SVG paths, and here a rectangle was drawn around the
      // icon that the editor never showed. Icons inserted under an older version carry
      // `strokeWidth: 2` from a shape's default values, so the border came out without
      // anyone asking for it.
      // `isSvg` as well, not only the type: icons inserted under an older version were
      // created as `geo` with the SVG inside the content, and those too must be left without
      // a box border.
      // Nor on shapes drawn with SVG: there the stroke goes on the figure's `stroke` and
      // follows the silhouette.
      // A `border` on top would be the rectangle this work was meant to remove.
      // 
      const hasVector = slotType === 'svg' || isSvg || !!style.svgRawXml
        || (isGeoLike && (!!shapeDrawing(style.geoShape) || !!style.svgPath));
      // The outline is the first 2.0 stroke with no `align` (outer and inner strokes
      // are drawn elsewhere). Without one, the 1.x fields still decide.
      // A text's 2.0 strokes are its letters' outline (below), never a box border.
      const v2Layer = v2Layers.get(String(slot.id));
      const v2Stroke = v2Layer?.strokes?.find((s) => !s.align && 'kind' in s.paint && s.paint.kind === 'color' && typeof s.width === 'number');
      const outline = v2Layer?.type === 'text'
        ? { color: '', width: 0, style: undefined }
        : v2Stroke
        ? { color: v2Colors.css((v2Stroke.paint as { value: unknown }).value) || '', width: v2Stroke.width as number, style: v2Stroke.style }
        : { color: resolveCssColor(style.strokeColorRole, style.strokeColor), width: style.strokeWidth, style: style.strokeStyle };
      if (outline.color && outline.width && !isWindowMask && !hasVector) {
        slotEl.style.setProperty('border', `${outline.width}px ${outline.style || 'solid'} ${outline.color}`);
      }
      // Non-rectangular shapes are drawn with SVG, as in the editor.
      //
      // They used to be `clip-path` on the <div> plus a CSS `border`, and that gave three
      // failures at once: the border drew the element's RECTANGLE instead of the silhouette
      // (a twin of the shadow failure), the points were copied by hand and did not match the
      // editor's, and the five shapes this engine did not know (heart, diamond, hexagon,
      // arrow and line) fell through to an `else` that only painted the background and
      // were published as coloured rectangles.
      const drawing = isGeoLike && !isWindowMask ? shapeDrawing(style.geoShape) : undefined;
      // Image fill (contract 1.17.0): the same resolution as an image layer's
      // content. A network URL is refused, as there (the file carries its picture).
      const fillImageSrc = isGeoLike && !isWindowMask && style.fillType === 'image' ? String(style.fillImage || '').trim() : '';
      const imageSrcSafe = !!fillImageSrc && isSandboxImageSrc(fillImageSrc);
      if (fillImageSrc && !imageSrcSafe) {
        console.warn('[OimPlayer] Fill image not embedded in the file (network URLs are not loaded), slot:', slot.id);
      }
      // The outline (and its fallback chain) is core's, so the editor draws the same.
      const silhouette = isGeoLike && !isWindowMask ? frameSilhouette(style) : null;
      if (silhouette) {
        const svgNs = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('viewBox', silhouette.viewBox);
        svg.setAttribute('preserveAspectRatio', 'none');
        // Anchored to the slot's box, like the fill layer. As a flex child it
        // came after the empty `oim-slot-loop-wrap` (one line tall), so the
        // drawing sat a few px lower than in the editor; with the fill layer at
        // the box, the stroke ring and the fill drifted apart.
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';
        svg.style.overflow = 'visible';

        const figure = document.createElementNS(svgNs, silhouette.points ? 'polygon' : 'path');
        if (silhouette.points) figure.setAttribute('points', silhouette.points);
        else figure.setAttribute('d', silhouette.d!);

        // An open stroke (the line or freehand drawing) with fill becomes a bar.
        // A custom svgPath keeps its colour fill off (as before); only a photo may fill it.
        const fillable = drawing && (drawing.kind === 'polygon' || drawing.fillable);
        const resolvedSvgFill = resolveCssColor(style.fillColorRole, style.fillColor);
        const imageFill = (!drawing || !!fillable) && imageSrcSafe;
        figure.setAttribute(
          'fill',
          fillable && resolvedSvgFill && style.fillType !== 'none' && !hasComplexFill && !imageFill ? resolvedSvgFill : 'none'
        );
        // The doodle is the only shape to which the editor gives stroke fallbacks:
        // without thickness it paints 2, and without a stroke colour it uses the fill colour.
        // These must be replicated, because being an open stroke it carries no fill
        // (`fillable: false`) and without a stroke nothing is left to see: the doodle
        // was visible in the editor and published invisible. The line, by contrast,
        // uses `strokeWidth ?? 0` in the editor, so it is left as it was.
        const isScribble = style.geoShape === 'scribble';
        const strokeThickness = v2Stroke ? outline.width : style.strokeWidth && style.strokeWidth > 0
          ? style.strokeWidth
          : (isScribble ? 2 : 0);
        const strokeColor = v2Stroke ? outline.color : (style.strokeColor || style.strokeColorRole)
          ? resolveCssColor(style.strokeColorRole, style.strokeColor || '#000000')
          : (isScribble ? (resolveCssColor(style.fillColorRole, style.fillColor) || '#2563EB') : '');
        if (strokeThickness && strokeColor) {
          figure.setAttribute('stroke', strokeColor);
          figure.setAttribute('stroke-width', String(strokeThickness));
          // Without this the stroke stretches with the layer: the `viewBox` goes with
          // `preserveAspectRatio: none`, so a wide and short shape would have a thick border on top
          // and a thin one on the sides.
          figure.setAttribute('vector-effect', 'non-scaling-stroke');
          figure.setAttribute('stroke-linejoin', 'round');
          figure.setAttribute('stroke-linecap', 'round');
          if (outline.style === 'dashed') figure.setAttribute('stroke-dasharray', '6,4');
          else if (outline.style === 'dotted') figure.setAttribute('stroke-dasharray', '2,3');
        }
        svg.appendChild(figure);
        slotEl.appendChild(svg);
        if (imageFill) {
          const d = silhouette.d ?? 'M ' + silhouette.points!.split(' ').join(' L ') + ' Z';
          mountImageFill(slotEl, style, { d, viewBox: silhouette.viewBox }, fillImageSrc);
        }

        // The colour goes on the <path>, not on the container, or the whole box would show
        // painted behind the figure.
        slotEl.style.backgroundColor = 'transparent';
        slotEl.style.padding = '0';
        slotEl.style.overflow = 'visible';
      } else if (isGeoLike && !isWindowMask) {
        const geoShape = style.geoShape;
        if (geoShape === 'circle') {
          slotEl.style.borderRadius = '50%';
          // And it is deleted from the styles object so the generic loop further down does
          // not overwrite it. `buildRawSlots` ALWAYS writes `border_radius_px: 0` in the .oim,
          // which arrives here as
          // `style.borderRadius = '0px'`, and that loop runs AFTER: the circle
          // ended up square.
          //
          // It had always been like this. It was not seen because the circles in templates
          // are usually locked and baked into the base image;
          // it only breaks when the circle is a live layer.
          delete style.borderRadius;
        } else if (geoShape === 'triangle') {
          slotEl.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
        } else if (geoShape === 'star') {
          slotEl.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        }
      }

      // Rectangles and unknown shapes have no silhouette: their picture is clipped
      // by a rect whose corner radius is a fraction of the box (0 = the whole box).
      if (imageSrcSafe && !silhouette) {
        const radio = parseFloat(String(style.borderRadius)) || 0;
        const cajaW = slot.width_px || baseWidth;
        const cajaH = slot.height_px || baseHeight;
        mountImageFill(slotEl, style, {
          d: '',
          viewBox: '0 0 1 1',
          rect: { rx: Math.min(Math.max(radio / cajaW, 0), 0.5), ry: Math.min(Math.max(radio / cajaH, 0), 0.5) },
        }, fillImageSrc);
      }

      if (hasComplexFill) {
        const fillLayer = document.createElement('div');
        fillLayer.className = 'oim-fill-layer';
        fillLayer.style.position = 'absolute';
        fillLayer.style.left = '0';
        fillLayer.style.top = '0';
        fillLayer.style.width = '100%';
        fillLayer.style.height = '100%';
        fillLayer.style.pointerEvents = 'none';
        fillLayer.style.borderRadius = 'inherit';
        const v2Fills = v2Layers.get(String(slot.id))?.fills;
        const fillCss: Record<string, string> = {
          ...(v2Fills?.length === 1
            ? paintCss(v2Fills[0], { colors: v2Colors, width: slot.width_px || baseWidth, height: slot.height_px || baseHeight })
            : getFillCss({
            type: slotType,
            width: slot.width_px || baseWidth,
            height: slot.height_px || baseHeight,
            fillType: style.fillType,
            fillColor: style.fillColor,
            fillGradient: style.fillGradient,
            fillGenerative: style.fillGenerative,
            fillPatternType: style.fillPatternType,
            fillPatternColor: style.fillPatternColor,
            fillPatternBgColor: style.fillPatternBgColor,
            fillPatternSpeed: style.fillPatternSpeed,
            fillPatternScale: style.fillPatternScale,
            fillPatternDirection: style.fillPatternDirection,
            fillPatternSvgs: style.fillPatternSvgs,
            fillPatternColors: style.fillPatternColors,
            fillPatternSizes: style.fillPatternSizes,
            fillPatternCounts: style.fillPatternCounts,
            fillPatternDispersions: style.fillPatternDispersions,
          })),
          ...(isVectorFill ? svgSilhouetteMaskCss(text) : shapeMaskCss(style.geoShape, style)),
        };
        // The drawing goes above the fill: a positioned sibling paints over a
        // static one, and the absolute fill layer hid the icon's stroke.
        if (isVectorFill && !loopWrap.style.position) loopWrap.style.position = 'relative';
        for (const [prop, value] of Object.entries(fillCss)) {
          if (prop.startsWith('--')) fillLayer.style.setProperty(prop, value);
          else (fillLayer.style as any)[prop] = value;
        }
        slotEl.insertBefore(fillLayer, slotEl.firstChild);
      }

      // Frame of the dedicated mask. Twin of CanvasArea.tsx: a <path> with
      // fill-rule="evenodd" paints the colour and leaves the silhouette hollow, and an
      // optional second <path> outlines the die-cut.
      if (isWindowMask) {
        // The frame is anchored to the canvas and overflows the slot's box on purpose,
        // so this slot cannot clip or centre like a text one.
        slotEl.style.overflow = 'visible';
        slotEl.style.display = 'block';
        slotEl.style.setProperty('padding', '0', 'important');
        slotEl.appendChild(buildWindowMaskSvg(slot, { width: baseWidth, height: baseHeight }));
      }

      // The padding of `.oim-slot` (`0 0.25em 0 0 !important`) exists so that the
      // last letter of an italic text is not cut. On a slot that is NOT
      // text it only widens the box: with `box-sizing: content-box !important` it is not
      // absorbed, so a 800x1200 slot measured 806.7x1203.2 and everything was shifted ~1.6px.
      // Measured in the real viewer.
      //
      // `paintsText` and not `!rawText`: for an image `rawText` is its source, so images kept
      // the padding, and a parallax image showed a strip at the
      // end of every lap (found in the library).
      if ((!paintsText && !isWindowMask) || duplicatedForInfinite) {
        slotEl.style.setProperty('padding', '0', 'important');
      }
 
      const zoneId = slot.zone_id || slot.z;
      let boxInCanvas: { x: number; y: number; width: number; height: number } | null = null;
      if (zoneId && zonesMap[zoneId]) {
        slotEl.style.position = 'relative';
        slotEl.style.left = 'auto';
        slotEl.style.top = 'auto';
        if (style.rotation) {
          slotEl.style.transform = 'rotate(' + style.rotation + 'deg)';
        } else {
          slotEl.style.transform = 'none';
        }
        slotEl.style.margin = '0';
      } else {
        const pos = normalizePosition(position || [0.5, 0.5]);
        // Reuse the already-correctly-resolved baseWidth/baseHeight (which fall
        // back through metadata.canvas.natural_width/natural_height) instead of
        // re-deriving origW/origH here — a prior local redeclaration of these
        // names only checked metadata.canvas_width/canvasWidth (missing the
        // nested canvas.natural_* fallback), so any file storing its canvas size
        // under metadata.canvas.natural_height fell back to a hardcoded 600,
        // scaling hRef ~2x and shifting every non-square-canvas slot downward.
        const origW = baseWidth;
        const origH = baseHeight;

        let wRef = 0;
        if (slot.width_px) {
          wRef = (slot.width_px / origW) * baseWidth;
        } else if (slot.widthPercent) {
          wRef = (slot.widthPercent / 100) * baseWidth;
        } else if (style.width != null && style.width !== '') {
          const resolvedW = resolveNumericDimension(style.width, baseWidth);
          wRef = resolvedW !== null ? resolvedW : (parseFloat(style.width) / 100) * baseWidth;
        }
        let hRef = 0;
        if (slot.height_px) {
          hRef = (slot.height_px / origH) * baseHeight;
        } else if (slot.heightPercent) {
          hRef = (slot.heightPercent / 100) * baseHeight;
        } else if (style.height != null && style.height !== '') {
          const resolvedH = resolveNumericDimension(style.height, baseHeight);
          hRef = resolvedH !== null ? resolvedH : (parseFloat(style.height) / 100) * baseHeight;
        }

        let anchorX = pos[0] * baseWidth;
        if (!duplicatedForInfinite) {
          if (textAlign === 'center') {
            anchorX += wRef / 2;
          } else if (textAlign === 'right') {
            anchorX += wRef;
          }
        }
        const anchorY = pos[1] * baseHeight + hRef / 2;

        const leftPx = anchorX.toFixed(2);
        const topPx = anchorY.toFixed(2);
        let transformX = '-50%';
        if (duplicatedForInfinite) {
          transformX = '0%';
        } else if (textAlign === 'right') transformX = '-100%';
        else if (textAlign === 'left') transformX = '0%';
 
        const transformY = '-50%';
 
        slotEl.style.position = 'absolute';
        // Placed from the 2.0 box: the same pixels as the 1.x anchor above,
        // which only the infinite duplicate still uses.
        const box = duplicatedForInfinite ? undefined : v2Layers.get(String(slot.id))?.box;
        if (box && box.width !== undefined && box.height !== undefined) {
          // The painted element is not always exactly the box (max-width, text
          // metrics), so it is pinned at the same point 1.x pinned, inside the box.
          const share = transformX === '0%' ? 0 : transformX === '-100%' ? 1 : 0.5;
          slotEl.style.left = (box.x + box.width * share).toFixed(2) + 'px';
          slotEl.style.top = (box.y + box.height / 2).toFixed(2) + 'px';
          slotEl.style.setProperty('--oim-ty', transformY);
        } else if (box) {
          [transformX] = anchorShift(box);
          const [, shiftY] = anchorShift(box);
          slotEl.style.left = box.x.toFixed(2) + 'px';
          slotEl.style.top = box.y.toFixed(2) + 'px';
          slotEl.style.setProperty('--oim-ty', shiftY);
        } else {
          slotEl.style.left = leftPx + 'px';
          slotEl.style.top = topPx + 'px';
        }

        const rotationDeg = style.rotation || 0;
        slotEl.style.setProperty('--oim-tx', transformX);
        if (!box) slotEl.style.setProperty('--oim-ty', transformY);
        slotEl.style.setProperty('--oim-rot', rotationDeg + 'deg');

        // The box already resolved in canvas pixels. It is kept because the
        // group wrapper, further down, needs it for its transform origin;
        // `pos`/`wRef`/`hRef` live only in this block.
        boxInCanvas = { x: pos[0] * baseWidth, y: pos[1] * baseHeight, width: wRef, height: hRef };
      }

      // A GROUP is not painted: it wraps. Up to phase 3 it arrived here like any
      // other slot and came out as an empty element with the group's box, on top of its
      // children (dead weight in a signed file).
      //
      // Here it is only CALCULATED. Applying it has to wait until after the loop that
      // dumps `style` onto the element, because that loop writes `style.width` and
      // `style.height` (which the backend ALWAYS emits, in cqw) and it overwrote the
      // wrapper's size, so the children came out at half
      // size and out of place.
      //
      // No test saw it: the slots they build carry no `style.width`, so the loop had
      // nothing to overwrite. It only appeared when a truly signed .oim was
      // opened.
      const wrapper = (isGroup(slot) && !isBackgroundSlot && boxInCanvas)
        ? wrapperStyle(boxInCanvas, { width: baseWidth, height: baseHeight })
        : null;

      // Full-cover background: anchor at top-left and span the whole overlay,
      // ignoring the center-anchor math AND the default 80% max-width / slot
      // padding (which would cap the fill at 80% and leave a strip uncovered).
      if (isBackgroundSlot) {
        slotEl.style.left = '0';
        slotEl.style.top = '0';
        slotEl.style.width = '100%';
        slotEl.style.height = '100%';
        slotEl.style.maxWidth = 'none';
        slotEl.style.maxHeight = 'none';
        slotEl.style.padding = '0';
        slotEl.style.boxSizing = 'border-box';
        slotEl.style.setProperty('--oim-tx', '0%');
        slotEl.style.setProperty('--oim-ty', '0%');
        slotEl.style.setProperty('--oim-rot', '0deg');
      }

      // Explicit effect mapping. The file stores these as plain numbers
      // (opacity 0-100, blur px, shadow* fields, textStrokeColor/Width) that
      // are NOT valid CSS on their own — the generic kebab-case pass-through
      // below would emit invalid values (opacity: 100 instead of 1), so they
      // need real translation to match the editor 1:1.
      //
      // Weight, style and decoration are NOT here: since contract 1.5.0 the
      // file carries `fontWeight`/`fontStyle`/`textDecoration`, which are CSS
      // already and go through the pass-through. The `bold`/`italic`/
      // `underline` shortcuts were retired and are ignored.
      const glyphStroke = v2Layers.get(String(slot.id))?.type === 'text'
        ? (() => {
            const s = v2Layers.get(String(slot.id))?.strokes?.[0];
            return s && 'kind' in s.paint && s.paint.kind === 'color' && typeof s.width === 'number'
              ? { width: s.width, color: v2Colors.css(s.paint.value) || '' }
              : undefined;
          })()
        : style.textStrokeWidth
          ? { width: style.textStrokeWidth, color: resolveCssColor(style.textStrokeColorRole || style.strokeColorRole, style.textStrokeColor || '#000000') }
          : undefined;
      if (glyphStroke) {
        slotEl.style.setProperty('-webkit-text-stroke', glyphStroke.width + 'px ' + glyphStroke.color);
        slotEl.style.setProperty('paint-order', 'stroke fill');
      }
      // style.blendMode retired in 1.12.0: it never showed here (each slot is
      // isolated) nor in the editor; readers draw the layer as normal.
      // Unified effects stack
      if (Array.isArray(style.effects) && style.effects.length > 0) {
        for (const eff of style.effects) {
          if (!eff || eff.enabled === false) continue;
          if (eff.type === 'blur') {
            const r = typeof eff.radius === 'number' ? eff.radius : 8;
            slotEl.style.filter = (slotEl.style.filter ? slotEl.style.filter + ' ' : '') + 'blur(' + r + 'px)';
          } else if (eff.type === 'drop-shadow') {
            const x = eff.x || 0;
            const y = eff.y !== undefined ? eff.y : 4;
            const b = eff.blur !== undefined ? eff.blur : 12;
            const rawColor = eff.color || 'rgba(0, 0, 0, 0.35)';
            const role = eff.colorRole || style.shadowColorRole;
            const c = role ? resolveCssColor(role, rawColor) : rawColor;
            if (slotType === 'text' || slotType === 'artistic-text') {
              const shadowPart = x + 'px ' + y + 'px ' + b + 'px ' + c;
              slotEl.style.textShadow = slotEl.style.textShadow ? slotEl.style.textShadow + ', ' + shadowPart : shadowPart;
            } else {
              slotEl.style.filter = (slotEl.style.filter ? slotEl.style.filter + ' ' : '') + 'drop-shadow(' + x + 'px ' + y + 'px ' + b + 'px ' + c + ')';
            }
          } else if (eff.type === 'glow') {
            const r = eff.radius || 16;
            const rawColor = eff.color || '#f59e0b';
            const role = eff.colorRole || style.effectColorRole;
            const c = role ? resolveCssColor(role, rawColor) : rawColor;
            if (slotType === 'text' || slotType === 'artistic-text') {
              const glowPart = '0px 0px ' + (r * 0.4) + 'px ' + c + ', 0px 0px ' + r + 'px ' + c;
              slotEl.style.textShadow = slotEl.style.textShadow ? slotEl.style.textShadow + ', ' + glowPart : glowPart;
            } else {
              slotEl.style.filter = (slotEl.style.filter ? slotEl.style.filter + ' ' : '') + 'drop-shadow(0px 0px ' + (r * 0.4) + 'px ' + c + ') drop-shadow(0px 0px ' + r + 'px ' + c + ')';
            }
          } else if (eff.type === 'texture') {
            const texDef = TEXTURE_CATALOG[eff.preset as TexturePreset];
            if (texDef) {
              if (slotType === 'text' || slotType === 'artistic-text') {
                const scale = eff.scale || 1.0;
                const w = texDef.tileWidth * scale;
                const h = texDef.tileHeight * scale;
                const baseColor = style.fillColor || style.color || '#18181b';
                const blend = eff.blend || texDef.defaultBlend || 'overlay';
                if (style.fillType === 'gradient' && style.fillGradient) {
                  slotEl.style.backgroundImage = 'url("' + texDef.getDataUri(eff.color, eff.intensity) + '"), ' + style.fillGradient;
                  slotEl.style.backgroundRepeat = 'repeat, no-repeat';
                  slotEl.style.backgroundSize = w + 'px ' + h + 'px, 100% 100%';
                  slotEl.style.backgroundBlendMode = blend + ', normal';
                } else {
                  slotEl.style.backgroundImage = 'url("' + texDef.getDataUri(eff.color, eff.intensity) + '"), linear-gradient(' + baseColor + ', ' + baseColor + ')';
                  slotEl.style.backgroundRepeat = 'repeat, no-repeat';
                  slotEl.style.backgroundSize = w + 'px ' + h + 'px, 100% 100%';
                  slotEl.style.backgroundBlendMode = blend;
                }
                slotEl.style.webkitBackgroundClip = 'text';
                (slotEl.style as any).backgroundClip = 'text';
                (slotEl.style as any).webkitTextFillColor = 'transparent';
                slotEl.style.color = 'transparent';
                // Same margin as a clipped fill: without it the descenders of a
                // tight line height (a «p» at line height 1) were left unfilled
                // while the text stroke still drew them.
                const texInk = inkMargin(resolveLineHeight(lineHeightSource));
                if (texInk > 0) {
                  slotEl.style.setProperty('padding-top', texInk + 'em', 'important');
                  slotEl.style.setProperty('padding-bottom', texInk + 'em', 'important');
                }
              } else {
                const overlay = document.createElement('div');
                overlay.className = 'oim-effect-texture';
                overlay.style.position = 'absolute';
                overlay.style.inset = '0';
                overlay.style.pointerEvents = 'none';
                overlay.style.borderRadius = 'inherit';
                overlay.style.mixBlendMode = eff.blend || texDef.defaultBlend || 'overlay';
                const opacityVal = (eff.intensity !== undefined ? eff.intensity : texDef.defaultIntensity) / 100;
                overlay.style.opacity = String(opacityVal);
                const scale = eff.scale || 1.0;
                const w = texDef.tileWidth * scale;
                const h = texDef.tileHeight * scale;
                overlay.style.backgroundImage = `url("${texDef.getDataUri(eff.color, eff.intensity)}")`;
                overlay.style.backgroundRepeat = 'repeat';
                overlay.style.backgroundSize = `${w}px ${h}px`;
                overlay.style.zIndex = '1';
                // On the layer's own pixels, not its box (@oim-media/core layerTextureMask):
                // an SVG with a transparent background came out as a coloured square.
                const mask = layerTextureMask({ type: slotType, svg: isSvg ? text : undefined, image: isImageSlot ? text.trim() : undefined, fit: style.objectFit });
                if (mask) {
                  const ms = overlay.style as CSSStyleDeclaration & { webkitMaskImage?: string; webkitMaskSize?: string; webkitMaskRepeat?: string; webkitMaskPosition?: string };
                  ms.maskImage = ms.webkitMaskImage = mask.image;
                  ms.maskSize = ms.webkitMaskSize = mask.size;
                  ms.maskRepeat = ms.webkitMaskRepeat = 'no-repeat';
                  ms.maskPosition = ms.webkitMaskPosition = 'center';
                }
                slotEl.appendChild(overlay);
              }
            }
          }
        }
      } else {
        // Fall back to legacy fields if style.effects is not present
        const layerBlur = typeof style.layerBlur === 'number' ? style.layerBlur : style.blur;
        if (typeof layerBlur === 'number' && layerBlur > 0) {
          slotEl.style.filter = (slotEl.style.filter ? slotEl.style.filter + ' ' : '') + 'blur(' + layerBlur + 'px)';
        }
        if (style.grain === true && (GRAIN_LAYER_TYPES as readonly string[]).includes(slotType)) {
          const grainId = 'oim-grain-' + String(slot.id).replace(/[^A-Za-z0-9_-]/g, '_');
          self._defineLayerGrain(grainId, style);
          slotEl.style.filter = (slotEl.style.filter ? slotEl.style.filter + ' ' : '') + 'url(#' + grainId + ')';
        }
        if (style.shadowEnabled) {
          if (!shadowFollowsGlyphs(slotType)) {
            slotEl.style.filter = (slotEl.style.filter ? slotEl.style.filter + ' ' : '') + dropShadowCss(style);
          } else {
            slotEl.style.textShadow = (style.shadowOffsetX || 0) + 'px ' + (style.shadowOffsetY || 0) + 'px ' + (style.shadowBlur || 0) + 'px ' + shadowColorCss(style);
          }
        }
      }

      // Editor opacity is 0-100; store the resolved 0-1 value so the fade-in
      // animation (which temporarily forces opacity to 1 while entering) can
      // settle on the shape's real target opacity instead of always landing
      // on fully opaque.
      const targetOpacity = style.opacity !== undefined ? Math.max(0, Math.min(100, style.opacity)) / 100 : 1;
      slotEl.dataset.oimOpacity = String(targetOpacity);
      slotEl.style.setProperty('--oim-target-opacity', String(targetOpacity));

      if (style.isVisible === false || slot.isVisible === false) {
        slotEl.style.display = 'none';
        slotEl.style.opacity = '0';
        slotEl.style.pointerEvents = 'none';
      }

      if (slotType === 'filter') {
        const filterCss = getFilterCss(slot);
        const filterValue = style.filterPreset === 'duotone'
          ? 'url(#' + getDuotoneFilterId(slot) + ')'
          : filterCss;
        if (filterValue) {
          slotEl.style.backdropFilter = filterValue;
          (slotEl.style as any).webkitBackdropFilter = filterValue;
        }
      }

      if (slotType === 'container') {
        const slotW = slot.width_px || (slot.widthPercent ? (slot.widthPercent / 100) * baseWidth : 300);
        const slotH = slot.height_px || (slot.heightPercent ? (slot.heightPercent / 100) * baseHeight : 200);

        const containerShape = {
          width: slotW,
          height: slotH,
          fillType: style.fillType,
          fillColor: style.fillColor,
          fillGenerative: style.fillGenerative,
          fillGradient: style.fillGradient,
          fillPatternType: style.fillPatternType,
          fillPatternColor: style.fillPatternColor,
          fillPatternBgColor: style.fillPatternBgColor,
          fillPatternSpeed: style.fillPatternSpeed,
          fillPatternScale: style.fillPatternScale,
        };

        const v2Fills = v2Layers.get(String(slot.id))?.fills;
        const containerCss = v2Fills?.length === 1
          ? paintCss(v2Fills[0], { colors: v2Colors, width: slotW, height: slotH })
          : getFillCss(containerShape);
        Object.assign(slotEl.style, containerCss);
      }

      Object.keys(style).forEach(function (key) {
        // `bold`, `italic`, `underline` and `color` were retired in contract
        // 1.5.0. They stay listed so a file that still carries them does not
        // leak them into the pass-through as CSS.
        if (key === 'bold' || key === 'italic' || key === 'underline' ||
            key === 'textStrokeWidth' || key === 'textStrokeColor' || key === 'textStrokeColorRole' ||
            key === 'fillColor' || key === 'fillColorRole' ||
            key === 'strokeColor' || key === 'strokeColorRole' ||
            key === 'color' || key === 'colorRole' ||
            key === 'maskBgColor' || key === 'maskBgColorRole' ||
            key === 'maskStrokeColor' || key === 'maskStrokeColorRole' ||
            key === 'blendMode' || key === 'blur' || key === 'opacity' ||
            key === 'shadowEnabled' || key === 'shadowColor' || key === 'shadowBlur' ||
            key === 'shadowOffsetX' || key === 'shadowOffsetY' || key === 'shadowOpacity' ||
            key === 'filterPreset' || key === 'filterBlur' || key === 'filterBrightness' ||
            key === 'filterContrast' || key === 'filterSaturate' || key === 'filterHueRotate' ||
            key === 'isMaskLayer') return;
        // `lineHeight` comes from the raw dump and goes through `resolveLineHeight`: the
        // file's value arrived here unvalidated, so a `0` collapsed the lines and a `99`
        // covered the rest of the document.
        if (key === 'maxWidth' || key === 'maxWidths' || key === 'textAlign' ||
            key === 'fontSize' || key === 'fontSizes' ||
            key === 'rotation' || key === 'animation' || key === 'objectFit' ||
            key === 'lineHeight' || key === 'fontFamily') return;
        // The 2.0 typography is already on the element.
        if (v2Typo && (key === 'fontWeight' || key === 'fontStyle' || key === 'letterSpacing' ||
            key === 'textTransform' || key === 'textDecoration')) return;
        if (key === 'position' || key === 'zIndex' || key === 'top' || key === 'left' ||
            key === 'right' || key === 'bottom' || key === 'display') return;
        let val = style[key];
        if (val === undefined || val === null || val === '') return;

        if (key === 'width' || key === 'height' || key === 'padding' || key === 'letterSpacing' || key === 'borderRadius' || key === 'borderWidth' || key === 'textShadow' || key === 'boxShadow' || key === 'outline' || key === '-webkit-text-stroke' || key === 'webkit-text-stroke') {
          val = scaleValue(val);
        }

        if (/\d(vw|vh|rem)/.test(String(val))) return;
        const cssKey = key.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
        slotEl.style.setProperty(cssKey, val);
      });

      // And it is APPLIED here, with `style` already dumped, so nothing overwrites it.
      if (wrapper) {
        slotEl.style.left = wrapper.left;
        slotEl.style.top = wrapper.top;
        slotEl.style.width = wrapper.width;
        slotEl.style.height = wrapper.height;
        slotEl.style.maxWidth = 'none';
        slotEl.style.maxHeight = 'none';
        slotEl.style.setProperty('padding', '0', 'important');
        slotEl.style.transformOrigin = wrapper.transformOrigin;
        slotEl.style.pointerEvents = wrapper.pointerEvents;
        slotEl.style.setProperty('--oim-tx', '0%');
        slotEl.style.setProperty('--oim-ty', '0%');
        // And the viewer's scale is NEUTRALIZED here.
        //
        // `--oim-scale` is set by the overlay and CASCADES to everything inside it;
        // `.oim-slot` applies it on its own transform. For a loose layer that is correct, but
        // the wrapper is a `.oim-slot` that CONTAINS others: its children received it twice
        // (their own and the wrapper's)
        // and came out at half size inside the group.
        //
        // Not visible in the engine tests: happy-dom does not compose transforms, so the width
        // measured in a real browser must be checked. It showed up when opening the .oim in the
        // player from the CDN.
        slotEl.style.setProperty('--oim-scale', '1');
        // A normal slot clips to its box; the wrapper of a normal group covers the whole
        // canvas, so with `overflow: hidden` any shadow or blur would be cut off. But if the
        // group is parallax (sceneLoop, isParallaxGroup or children with infinite parallax),
        // it MUST clip with `hidden` so that the duplicated infinite track does not overflow
        // outside the frame.
        const hasParallaxChildren = groupChildren.get(slot.id)?.some((cid) => {
          const cSlot = slots.find((s: any) => s.id === cid);
          return cSlot && ((cSlot.parallax && cSlot.parallax.enabled) || (cSlot.style?.parallax && cSlot.style.parallax.enabled));
        });
        const isParallaxGrp = !!(
          slot.isParallaxGroup ||
          style.isParallaxGroup ||
          slot.is_parallax_group ||
          style.sceneLoop ||
          (slot.name && String(slot.name).toLowerCase().includes('parallax')) ||
          (slot.id && String(slot.id).startsWith('grp-parallax')) ||
          hasParallaxChildren
        );
        slotEl.style.overflow = isParallaxGrp ? 'hidden' : 'visible';

        // The children go into `loopWrap`, not into `slotEl`. It marks this for the
        // nesting step at the end.
        //
        // `loopWrap` is where the slot's animation runs: transforms are applied there and
        // NEVER on `slotEl`, because the `.oim-slot` transform is its position anchor. If the
        // children hung from `slotEl` they would be SIBLINGS of the animation instead of inside it,
        // and animating a group would move an empty wrapper
        // and leave them still.
        setFlag(loopWrap, 'data-oim-group', 'data-oim-grupo', String(slot.id));
        // And it has to rotate around the center of the GROUP.
        // `.oim-slot-loop-wrap` carries `center center`, which on a wrapper of the canvas size is
        // the center of the CANVAS: rotating from there would send the group
        // to the other end.
        loopWrap.style.transformOrigin = wrapper.transformOrigin;
        // And it has to fill the whole wrapper: `.oim-slot-loop-wrap` is
        // `height: auto`, which with no content of its own measures zero.
        loopWrap.style.height = '100%';
        loopWrap.style.overflow = 'visible';
      }

      if (style.animation && !self.disableAnimations) {
        const anim = style.animation;
        
        // Structured keyframes: the new path. It runs on loopWrap,
        // NEVER on slotEl: the .oim-slot transform is the positioning anchor
        // (translate(var(--oim-tx,-50%), ...)) and animating it
        // would move the shape out of its place.
        //
        // loopWrap's opacity multiplies on its own with slotEl's (which carries the entry fade-in
        // and the shape's base opacity) by DOM composition, so there is no conflict to sequence.
        if (Array.isArray(anim.keyframes) && anim.keyframes.length >= 2 && typeof loopWrap.animate === 'function') {
          const animDuration = anim.duration || 8;
          if (animDuration > 0) {
            const frames = keyframesToWaapi(anim.keyframes, animDuration);
            // `trigger: "action"` waits for a `play` action: one run, resting
            // on the first keyframe until then.
            const onAction = anim.trigger === 'action';
            const instance = loopWrap.animate(frames, {
              duration: animDuration * 1000,
              iterations: onAction ? 1 : Infinity,
              // The real easing lives per keyframe; here it must stay linear so it is not
              // applied twice.
              easing: 'linear',
              ...(onAction ? { fill: 'both' as const } : {}),
            });
            if (onAction) {
              instance.pause();
              instance.currentTime = 0;
            } else {
              if (self._paused) instance.pause();
              // Only looping timelines: play() would replay a finished one-shot.
              self._animations.push(instance);
            }
            self._timelines.set(String(slot.id), instance);
          }
        }

        // `custom` is not applied since contract 1.9.0. It carried raw CSS
        // (`custom_loop_css`, `custom_keyframes`, `custom_hover_css`) into a
        // stylesheet, where `@import`, `image-set()` or a `}` breaking out of
        // the rule could ping a third party or restyle the player. The editor
        // never wrote it; only the catalogue classes remain.
        if (anim.loop && anim.loop !== 'none' && anim.loop !== 'custom') {
          loopWrap.classList.add('oim-loop-' + anim.loop);
          if (anim.duration) {
            loopWrap.style.setProperty('--oim-loop-duration', anim.duration + 's');
          }
          if (anim.delay) {
            loopWrap.style.setProperty('--oim-loop-delay', anim.delay + 's');
          }
        }

        if (anim.hover && anim.hover !== 'none' && anim.hover !== 'custom') {
          hoverWrap.classList.add('oim-hover-' + anim.hover);
        }
      }

      if (!self.disableActions && slot.interaction && slot.interaction.action_type === 'toggle_elements') {
        const targetConfig = slot.interaction.target;
        if (targetConfig) {
          slotEl.addEventListener('click', function (e) {
            e.stopPropagation();
            self.executeToggleState(targetConfig);
          });
          slotEl.style.cursor = 'pointer';
        }
      }

      // The interaction fields travel inside `slot.style`, which is where
      // `buildSlotStyle` puts them in the editor. The root is also accepted because
      // hand-written slots carry them there.
      //
      // Reading them ONLY from the root was the failure this feature was born with: the file
      // was fine (isInteractive true, states.hover.actions with its target) and the player hooked
      // up nothing, because the condition was never true. No test saw it: all of them build the
      // slot in the shape the code expects. The first real .oim that was opened showed it.
      // In image mode it is not even read: so nothing is hooked AND no console warning
      // is raised. That actionEvent exists for "the file asks for it and the player does not know";
      // here the player does know and has decided not to do it, so it would send people
      // looking for a failure that does not exist, and in a gallery of twenty, twenty times.
      const { isInteractive, states: slotStates } = self.disableActions
        ? { isInteractive: false, states: undefined }
        : readInteraction({
            isInteractive: slot.isInteractive,
            states: slot.states,
            style: style as any
          }, slot.id);

      if (isInteractive && slotStates) {
        const baseVisibility: Record<string, boolean> = {};
        const baseText: Record<string, string> = {};

        // Targets already warned about, so the actionEvent is not repeated on every hover.
        // It lives here (per slot and per load) and not on the instance, because its lifetime
        // is exactly that of these handlers.
        const warnedTargets = new Set<string>();

        const actionRunner: ActionRunner = {
          run: function (actions, trigger) {
            const shadow = self.host.shadowRoot;
            if (!shadow) return;

            // The player SAYS what it is going to do; it does not do what it is told.
            //
            // The .oim cannot cause anything on its own: it declares no handler,
            // no URL, no target outside itself. It is only announced, and it is only
            // useful if the page bothers to listen. That is the consent boundary of whoever embeds it.
            //
            // And that is what makes it UNNECESSARY for the player to navigate: if a page
            // wants a click to lead to a product, it listens and navigates itself, with
            // its own URL and rules.
            //
            // The detail carries ONLY identifiers that the author put in the file. No URLs or
            // content: it is not a channel to the outside;
            // it is the document speaking about itself.
            const actionEvent = new CustomEvent('oim:action', {
              cancelable: true,
              detail: {
                slot: slot.id,
                // The id is made up at random by the editor, so nobody can
                // write `e.detail.slot === "Boton1"`. `name` is what the author types and sees in
                // their layer list. The id stays as the stable key (`targets` use it); the
                // name is the readable one.
                // Names are NOT unique: whoever listens must know that.
                name: slot.name,
                trigger: trigger || 'unknown',
                targets: actions.map(function (a) { return a.target; }),
                types: actions.map(function (a) { return a.type; }),
              },
            });
            self.host.dispatchEvent(actionEvent);
            // `preventDefault()` vetoes the local effect. With this a gallery
            // can decide click by click without even needing `mode="image"`.
            // It exits BEFORE touching `baseVisibility`, so the `revert` of a vetoed hover
            // finds nothing to restore either.
            if (actionEvent.defaultPrevented) return;

            // `play` runs a timeline; it has no visibility to record or revert.
            actions.forEach(function (act) {
              if (act.type === 'play' && act.target) self._playTimeline(String(act.target));
            });
            const currentVis: Record<string, boolean> = {};
            actions.forEach(function (act) {
              if (!act.target || act.type === 'play') return;
              const targetEl = shadow.querySelector('[data-slot-id="' + act.target + '"]') as HTMLElement | null;

              // A target that does not exist is the failure that appears when a layer that was
              // the target of a reveal is deleted: the action stays in the file, already signed, and does
              // nothing. It is warned about once.
              if (!targetEl && !warnedTargets.has(act.target)) {
                warnedTargets.add(act.target);
                console.warn(
                  '[OimPlayer] The slot "' + slot.id + '" has an action "' + act.type +
                    '" aimed at "' + act.target + '", which does not exist in this file. It does nothing.'
                );
              }

              const isVis = targetEl ? (targetEl.style.display !== 'none' && targetEl.style.opacity !== '0') : true;
              currentVis[act.target] = isVis;
              if (baseVisibility[act.target] === undefined) {
                baseVisibility[act.target] = isVis;
              }
              if (act.type === 'setText' && baseText[act.target] === undefined) {
                const targetWrap = targetEl ? (targetEl.querySelector('.oim-slot-hover-wrap') as HTMLElement | null) : null;
                baseText[act.target] = targetWrap ? (targetWrap.textContent || '') : (targetEl ? targetEl.textContent || '' : '');
              }
            });

            const res = resolveActions(actions, currentVis);

            for (const [targetId, shouldShow] of Object.entries(res.visibility)) {
              const targetEl = shadow.querySelector('[data-slot-id="' + targetId + '"]') as HTMLElement | null;
              if (!targetEl) continue;
              if (shouldShow) {
                self._showSlotElement(targetEl);
              } else {
                self._hideSlotElement(targetEl);
              }
            }

            for (const [targetId, txt] of Object.entries(res.texts)) {
              const targetEl = shadow.querySelector('[data-slot-id="' + targetId + '"]') as HTMLElement | null;
              if (!targetEl) continue;
              const targetWrap = targetEl.querySelector('.oim-slot-hover-wrap') as HTMLElement | null;
              if (targetWrap) {
                targetWrap.textContent = txt;
              } else {
                targetEl.textContent = txt;
              }
            }
          },
          revert: function (actions) {
            const shadow = self.host.shadowRoot;
            if (!shadow) return;

            actions.forEach(function (act) {
              if (!act.target || act.type === 'play') return;
              const targetEl = shadow.querySelector('[data-slot-id="' + act.target + '"]') as HTMLElement | null;
              if (!targetEl) return;

              if (baseVisibility[act.target] !== undefined) {
                const baseVis = baseVisibility[act.target];
                delete baseVisibility[act.target];
                if (baseVis) {
                  self._showSlotElement(targetEl);
                } else {
                  self._hideSlotElement(targetEl);
                }
              }

              if (baseText[act.target] !== undefined) {
                const baseTxt = baseText[act.target];
                delete baseText[act.target];
                const targetWrap = targetEl.querySelector('.oim-slot-hover-wrap') as HTMLElement | null;
                if (targetWrap) {
                  targetWrap.textContent = baseTxt;
                } else {
                  targetEl.textContent = baseTxt;
                }
              }
            });
          }
        };

        const onOutsideTap: RegisterOutsideTap = function (el, leave) {
          if (self._activeTouchSlot && self._activeTouchSlot.el !== el) {
            self._activeTouchSlot.leave();
          }
          self._activeTouchSlot = { el: el, leave: leave };
        };

        bindStates(
          slotEl,
          slotStates,
          function (el, styles) {
            self.queueUpdate(el, styles);
          },
          actionRunner,
          onOutsideTap
        );
      }

      if (isArtisticText) {
        slotEl.style.backgroundColor = 'transparent';
        slotEl.style.overflow = 'visible';
        slotEl.style.setProperty('padding', '0', 'important');
      }

      // `zoneId` (resolved above as `slot.zone_id || slot.z`) is reused verbatim
      // so the attach step below and the zone-relative positioning branch at the
      // top of this block can never disagree about which zone a slot belongs to.
      // Contract 1.14.0: the flip goes in an inner element. The slot keeps
      // its rotation and its animations, which rewrite its own transform.
      // A transformed element is the containing block of what it holds, so
      // absolutely placed fills and a group's children flip with it.
      const flip = flipScale(style.flipX, style.flipY);
      if (flip) {
        const inner = document.createElement('div');
        inner.setAttribute('data-oim-flip', '');
        inner.style.width = '100%';
        inner.style.height = '100%';
        inner.style.transformOrigin = '50% 50%';
        inner.style.transform = 'scale(' + flip[0] + ', ' + flip[1] + ')';
        while (slotEl.firstChild) inner.appendChild(slotEl.firstChild);
        slotEl.appendChild(inner);
      }
      return { slotEl: slotEl, zoneId: zoneId, slot: slot };
    });

    const results = await Promise.all(slotPromises);

    // Slots that live inside a zone attach directly to that zone's container,
    // exactly as before — zones sit outside the mask/filter composition,
    // which only concerns the top-level stack.
    // The composition tree addresses elements by slot id, so a missing or
    // duplicated id used to collapse two slots onto one map entry — and since
    // `attachCompositionNode` skips a node whose element is absent, the loser
    // DISAPPEARED from the DOM. The old index-based append was immune to that.
    //
    // Fix: every slot gets a guaranteed-unique composition key, synthesised
    // from its index when its own id is unusable. Both the element map and
    // `compositionSlots` below are keyed off this same index-aligned array, so
    // they can never disagree; a bad id degrades to "renders unkeyed, in
    // order" instead of "vanishes". The synthetic key is internal — the mask
    // clip-path / duotone filter ids derived from it in `buildLayerComposition-
    // Defs` are built from these very same composition slots, so they still
    // match the `url(#...)` references emitted alongside them.
    const compositionKeys: string[] = [];
    const seenKeys = new Set<string>();
    slots.forEach(function (s: any, i: number) {
      const rawId = s && s.id !== undefined && s.id !== null && s.id !== '' ? String(s.id) : '';
      let key: string;
      if (!rawId) {
        console.warn('[OimPlayer] Slot #' + i + ' has no id; rendering it unkeyed and in stack order.', s);
        key = '__oim-unkeyed-' + i;
      } else if (seenKeys.has(rawId)) {
        console.warn('[OimPlayer] Duplicate slot id "' + rawId + '" at index ' + i + '; rendering it unkeyed and in stack order.');
        key = '__oim-dup-' + rawId + '-' + i;
      } else {
        key = rawId;
      }
      seenKeys.add(key);
      compositionKeys.push(key);
    });

    const elByCompositionId = new Map<string, HTMLElement>();
    results.forEach(function (res, i) {
      if (!res) return;
      const slotEl = res.slotEl;
      const zoneId = res.zoneId;
      if (zoneId && zonesMap[zoneId]) {
        zonesMap[zoneId].appendChild(slotEl);
      } else {
        elByCompositionId.set(compositionKeys[i], slotEl);
      }
    });

    // Top-level slots go through computeLayerComposition so `isMaskLayer`
    // slots can clip their preceding sibling and `type === 'filter'` slots
    // can wrap everything accumulated so far. `results` (and therefore
    // elByCompositionId's insertion order) already mirrors the original
    // `slots` array order — driven by Array.map, not by promise resolution
    // timing — so a project using neither feature produces exactly one
    // `{kind:'shape'}` node per slot, in the same order, and the fragment
    // below ends up identical to the old "append as each promise resolves"
    // loop.
    const compositionSlots: CompositionSlot[] = [];
    slots.forEach(function (s: any, i: number) {
      const zid = s.zone_id || s.z;
      if (zid && zonesMap[zid]) return;
      // The geometry travels too: getMaskClipPathD needs it to place
      // the silhouette in canvas coordinates. Before, only id, type and
      // style were copied, so the mask did not know where it was.
      compositionSlots.push({
        id: compositionKeys[i],
        type: s.type,
        style: s.style || {},
        position: s.position,
        width_px: s.width_px,
        height_px: s.height_px
      } as any);
    });
    const compositionNodes = computeLayerComposition(compositionSlots);

    // `isMaskLayer` disappeared when the mask was turned into its own type.
    // Checking it here meant the definitions were never generated and the
    // clipPath pointed at a nonexistent id: it clipped nothing.
    const hasMask = compositionSlots.some(function (s) { return s.type === 'mask'; });
    const hasDuotoneFilter = compositionSlots.some(function (s) { return s.type === 'filter' && !!(s.style && s.style.filterPreset === 'duotone'); });
    if (hasMask || hasDuotoneFilter) {
      fragment.appendChild(buildLayerCompositionDefs(compositionSlots, { width: baseWidth, height: baseHeight }));
    }

    compositionNodes.forEach(function (node) { attachCompositionNode(node, fragment, elByCompositionId); });

    // The children go INSIDE their group. It is done after composing, and not
    // inside `computeLayerComposition` on purpose: the composition decides
    // what clips what across the whole stack (masks and filters), and putting the hierarchy
    // in there would mix two unrelated problems.
    //
    // `appendChild` MOVES the node, so each child leaves its place in the stack and
    // enters the group keeping the relative order among siblings.
    // The group already occupies its position, and its children came after it.
    //
    // Anything that fails here degrades to the old behaviour: a file without
    // `style.groupId` nests nothing, a child whose group did not arrive stays
    // loose with its canvas coordinates, and a child inside a zone is not even in this map.
    // No layer can disappear.
    if (onlyIds) {
      // Substitution in place: the old node yields its spot to the new one and the
      // rest of the canvas does not notice. It keeps order, animations and parallax.
      results.forEach(function (res: any) {
        if (!res) return;
        const slotIdText = res.slotEl.getAttribute('data-slot-id') || '';
        const previous = layer.querySelector('[data-slot-id="' + slotIdText + '"]');
        if (previous && previous.parentNode) {
          // A repainted group has to carry its children over to the new element.
          // Without this, `replaceChild` swaps the old wrapper (which CONTAINS them) for an empty
          // one, and the layers inside vanish from the canvas as soon as the group is repainted,
          // for example when switching language. Only the slot nodes move;
          // anything else hanging from an element (svg, lottie wrappers) belongs to it
          // and is already rebuilt.
          // 
          const inside = previous.querySelectorAll('[data-oim-group] > [data-slot-id], :scope > [data-slot-id]');
          for (let i = 0; i < inside.length; i++) {
            res.slotEl.appendChild(inside[i]);
          }
          previous.parentNode.replaceChild(res.slotEl, previous);
          // The controller keeps the node, not the id: if it is not repointed, it would keep
          // moving the old node and the new layer would stay still.
          if (self._parallaxController) self._parallaxController.retarget(slotIdText, res.slotEl);
        }
      });
    } else {
      layer.innerHTML = '';
      layer.appendChild(fragment);
    }

    // The children go INSIDE their group. It is done on the tree ALREADY mounted and
    // not on the fragment, and after the partial substitution and not before,
    // because of a case that escapes if done the other way round: in a partial repaint
    // that touches the group AND a child, `replaceChild` puts the new child inside the
    // OLD element of the group and then substitutes that whole group.
    // The child went with it, and the layer vanished from the canvas.
    //
    // Nesting at the end is also idempotent: `appendChild` on a node that
    // is already inside only reorders it to the end, and as it is traversed in stack order,
    // the order among siblings is kept.
    //
    // It is also done after composing and not inside
    // `computeLayerComposition` on purpose: the composition decides what clips what
    // across the whole stack (masks and filters), and putting the hierarchy in there
    // would mix two unrelated problems.
    //
    // Anything that fails here degrades to the old behaviour: a file without
    // `style.groupId` nests nothing, and a child whose group did not arrive stays
    // loose with its canvas coordinates. No layer can disappear.
    if (groupChildren.size > 0) {
      const inZone = function (el: Element): boolean {
        for (const zoneId in zonesMap) {
          if (zonesMap[zoneId] && zonesMap[zoneId].contains(el)) return true;
        }
        return false;
      };
      groupChildren.forEach(function (childIds: string[], groupId: string) {
        const groupSlot = layer.querySelector('[data-slot-id="' + groupId + '"]');
        // A zone is a container with its own flow: taking a layer out of there to put it
        // in a group would reposition it without anyone asking.
        if (!groupSlot || inZone(groupSlot)) return;
        // Inside the container that ANIMATES, not the slot: see the comment on
        // `data-oim-group` above.
        const groupEl = groupSlot.querySelector('[data-oim-group="' + groupId + '"]') || groupSlot;
        childIds.forEach(function (childId: string) {
          const childEl = layer.querySelector('[data-slot-id="' + childId + '"]');
          if (!childEl || inZone(childEl)) return;
          groupEl.appendChild(childEl);
        });
      });
    }

    if (!onlyIds) {
      const hasParallax = slots.some(function (s: any) {
        return s.parallax && s.parallax.enabled && s.parallax.mode !== 'infinite_horizontal';
      }) || (this.metadata && Array.isArray(this.metadata.capabilities) && this.metadata.capabilities.includes('vector_parallax'));
      if (hasParallax) {
        try {
          // Without this they accumulated: each full render created a
          // controller with its mousemove listener and its rAF loop, and the
          // previous one kept running forever.
          if (this._parallaxController) {
            try { this._parallaxController.destroy(); } catch (e) {}
          }
          // A still player (`disable-animations`, every card of the mobile
          // gallery) gets no controller: it listens to `pointermove` on the
          // whole window and measures its card on each event, so twenty still
          // cards made scrolling with the finger stutter. The oversize below
          // is still computed, so the composition is the same.
          //
          // One created while the player is paused is born paused: this runs
          // after `pause()`, and the constructor starts its frame loop.
          const pCtrl = this._isStill() ? null : new ParallaxController(layer);
          this._parallaxController = pCtrl;
          if (pCtrl && this._paused) pCtrl.pause();
          slots.forEach(function (s: any, i: number) {
            if (s.parallax && s.parallax.enabled && s.parallax.mode !== 'infinite_horizontal') {
              const compId = compositionKeys[i];
              const el = elByCompositionId.get(compId);
              if (el) {
                const depth = s.parallax.depth !== undefined ? s.parallax.depth : 0.5;
                const axis = s.parallax.axis || 'both';

                // Oversizing: a layer stuck to the edge uncovers the void when it moves.
                // It is enlarged just enough so it is not seen, and only if it reaches the edge
                // (otherwise, moving apart a bit is the effect).
                //
                // The box is recalculated instead of measuring the node: `offsetWidth`
                // here is 0 while the canvas has not been laid out.
                const isBackground = s.is_background_pattern === true || s.id === 'background-pattern-slot';
                const pos = normalizePosition(s.position || [0.5, 0.5]);
                const layerWidth = isBackground ? baseWidth
                  : (s.width_px || (s.widthPercent ? (s.widthPercent / 100) * baseWidth : 0));
                const layerHeight = isBackground ? baseHeight
                  : (s.height_px || (s.heightPercent ? (s.heightPercent / 100) * baseHeight : 0));
                // The three alignments cancel out with their own `--oim-tx`:
                // the left edge ends at `pos[0] * width` in all three.
                const scale = oversizeScale(
                  {
                    left: isBackground ? 0 : pos[0] * baseWidth,
                    top: isBackground ? 0 : pos[1] * baseHeight,
                    width: layerWidth,
                    height: layerHeight,
                  },
                  { width: baseWidth, height: baseHeight },
                  depth,
                  axis,
                  // The NODE is checked and the condition is not rebuilt. The player
                  // mounts the track if the speed is not zero (without looking at the
                  // mode), and the editor if the mode is infinite or `inf.enabled`:
                  // these are two different conditions, and rewriting either of them
                  // here would be a third one.
                  !!el.querySelector('.' + TRACK_CLASS)
                );
                if (scale !== 1) el.style.setProperty('--oim-scale', String(scale));

                if (pCtrl) pCtrl.registerSlot({
                  id: s.id,
                  element: el,
                  depth: depth,
                  mode: s.parallax.mode || 'mouse',
                  axis: axis,
                });
              }
            }
          });
        } catch (err) {
          console.warn('[OIM Player] Failed to load ParallaxController extension:', err);
        }
      }
    }

    // The veil is the only entrance: every layer is placed at its final
    // opacity and size underneath it, and the veil lifts once what the layers
    // need is ready. A per-layer fade-in played after the veil lifted, so the
    // image was seen being built piece by piece and texts growing into size.
    try {
      await Promise.all(fontPromises);
    } catch (err) {
      console.warn('[OIM Player] Font load fallback activado.', err);
    }
    layer.querySelectorAll('.oim-slot').forEach(function (node: any) {
      node.style.opacity = node.dataset.oimOpacity !== undefined ? node.dataset.oimOpacity : '1';
    });
    await self._mediaSettled(layer);

    self._buildA11y();
    self.updateViewportSize();
    self.updateScale();

    if (self._viewport) {
      self._viewport.classList.add('oim-viewport--ready');
      self._revealed = true;
    }
  }

  /**
   * Puts the core's grain filter for one layer into this player's own defs.
   * Parsed as SVG, never assigned as HTML: the markup is built from a
   * sanitised id, clamped numbers and a fixed list of blend modes.
   */
  private _defineLayerGrain(id: string, style: any): void {
    // In the viewport, NOT in the overlay: a full render empties the overlay
    // (innerHTML = '') after the slots are styled, and took the defs with it.
    // Same shadow root, so url(#id) still resolves.
    const layer = this._viewport || this._overlay;
    if (!layer || typeof DOMParser === 'undefined') return;
    let defs = layer.querySelector(':scope > svg.oim-grain-defs > defs');
    if (!defs) {
      const svgNs = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('class', 'oim-grain-defs');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('style', 'position:absolute;pointer-events:none');
      defs = document.createElementNS(svgNs, 'defs');
      svg.appendChild(defs);
      layer.appendChild(svg);
    }
    const existing = defs.querySelector('#' + id);
    if (existing) existing.remove();
    const markup = buildLayerGrainFilter(id, {
      intensity: style.grainIntensity,
      size: style.grainSize,
      blend: style.grainBlend,
    });
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs>' + markup + '</defs></svg>',
      'image/svg+xml'
    );
    const filter = doc.querySelector('filter');
    if (filter) defs.appendChild(document.importNode(filter, true));
  }

  /** True once the veil has lifted for the first time. */
  private _revealed = false;

  /**
   * Resolves when the layers' images are decoded and their Lottie animations
   * have built their DOM, or after REVEAL_MEDIA_CAP_MS, whichever comes first:
   * a broken or slow asset must never leave the image hidden. Then waits two
   * frames so layout and scale have been applied before the veil lifts.
   */
  private _mediaSettled(layer: HTMLElement): Promise<void> {
    const waits: Promise<unknown>[] = [];
    layer.querySelectorAll('img').forEach(function (img) {
      if (typeof img.decode === 'function' && img.getAttribute('src')) {
        waits.push(img.decode().catch(function () {}));
      }
    });
    (this._lottieInstances || []).forEach(function (reg) {
      const inst: any = reg.inst;
      if (inst && !inst.isLoaded && typeof inst.addEventListener === 'function') {
        waits.push(new Promise<void>(function (r) {
          inst.addEventListener('DOMLoaded', r);
          inst.addEventListener('data_failed', r);
        }));
      }
    });
    const cap = new Promise<void>(function (r) { setTimeout(r, REVEAL_MEDIA_CAP_MS); });
    const frames = () => new Promise<void>(function (r) {
      if (typeof requestAnimationFrame !== 'function') { r(); return; }
      requestAnimationFrame(function () { requestAnimationFrame(function () { r(); }); });
    });
    return Promise.race([Promise.all(waits), cap]).then(frames);
  }

  // Batched update pipeline to avoid reflows (Lottie style)
  private _pendingDOMUpdates = new Map<HTMLElement, Record<string, string | undefined>>();
  private _isUpdateScheduled = false;
  private _updateCallbacks: (() => void)[] = [];

  public queueUpdate(el: HTMLElement, styles: Partial<CSSStyleDeclaration> | Record<string, string | undefined>, callback?: () => void) {
    // Strings only, and this is not a mere formality of types.
    //
    // `Partial<CSSStyleDeclaration>` also brings `length` (a number) and a
    // dozen methods such as `setProperty`. `_flushDOMUpdates` walks this
    // map with `Object.entries` and assigns each key to `el.style[k]`, so
    // a `length` that slips in would end up as `el.style.length = 5`, and a method as
    // `el.style.setProperty = fn`: neither does anything and neither complains, and the style
    // that comes after it is applied all the same. A failure that
    // only shows if you go looking for it.
    const stringsOnly: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(styles)) {
      if (typeof value === 'string' || value === undefined) stringsOnly[key] = value;
    }

    this._pendingDOMUpdates.set(el, {
      ...(this._pendingDOMUpdates.get(el) || {}),
      ...stringsOnly
    });
    
    if (callback) {
      this._updateCallbacks.push(callback);
    }
    
    if (!this._isUpdateScheduled) {
      this._isUpdateScheduled = true;
      requestAnimationFrame(() => this._flushDOMUpdates());
    }
  }

  private _flushDOMUpdates() {
    this._pendingDOMUpdates.forEach((styles, el) => {
      for (const [k, v] of Object.entries(styles)) {
        if (k.startsWith('--')) {
          if (v === '' || v === undefined || v === null) {
            el.style.removeProperty(k);
          } else {
            el.style.setProperty(k, String(v));
          }
        } else {
          (el.style as any)[k] = v;
        }
      }
    });
    this._pendingDOMUpdates.clear();
    this._isUpdateScheduled = false;

    // Run callbacks safely in the next microtask
    const callbacks = this._updateCallbacks;
    this._updateCallbacks = [];
    callbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  private _hideSlotElement(el: HTMLElement): void {
    if (this.disableAnimations) {
      this.queueUpdate(el, { display: 'none', opacity: '0', pointerEvents: 'none' });
      return;
    }
    this.queueUpdate(el, { pointerEvents: 'none' }, () => {
      this._runReveal(el, false, () => this.queueUpdate(el, { display: 'none' }));
    });
  }

  /**
   * Neither `_showSlotElement` nor `_hideSlotElement` writes `transform`.
   *
   * The slot is placed with `transform: translate(-50%, -50%)` over its
   * `position`: that is how the file says "the centre of the layer". Writing
   * `transform` for the entrance overwrote that centring and the layer showed
   * up half a layer off. The reveal moves the independent `translate` and
   * `scale` properties instead, which compose with it (see `revealFrames`).
   */
  private _showSlotElement(el: HTMLElement): void {
    if (this.disableAnimations) {
      this.queueUpdate(el, { display: 'flex', opacity: '1', pointerEvents: 'auto' });
      return;
    }
    this.queueUpdate(el, { display: 'flex', pointerEvents: 'auto' }, () => this._runReveal(el, true));
  }

  /** The `play` action: runs a slot's keyframe timeline from the start. */
  _playTimeline(id: string): void {
    const t = this._timelines.get(id);
    if (!t) {
      // With animations off (reduced motion included) no timeline exists: nothing to play.
      if (!this.disableAnimations && !this._warnedPlay.has(id)) {
        this._warnedPlay.add(id);
        console.warn('[OimPlayer] play: no animation', id);
      }
      return;
    }
    t.currentTime = 0;
    if (!this._paused) t.play();
  }

  /** Plays the layer's reveal; `done` runs only if it finishes (not if a newer one cancels it). */
  private _runReveal(el: HTMLElement, entering: boolean, done?: () => void): void {
    const prev = this._revealAnims.get(el);
    // Start from where the cancelled reveal left the layer, not from its first frame.
    const now = prev ? getComputedStyle(el) : undefined;
    if (prev) { prev.cancel(); this._revealAnims.delete(el); }
    el.style.opacity = entering ? '1' : '0';
    const t = revealTiming((el as any)._oimReveal, entering);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || t.duration === 0 || typeof el.animate !== 'function') { done?.(); return; }
    const frames = revealFrames(t.effect, entering);
    if (now) for (const k of ['opacity', 'translate', 'scale'] as const) {
      const v = now[k];
      if (v && v !== 'none') frames[0][k] = v;
    }
    const a = el.animate(frames, { duration: t.duration, easing: t.easing, fill: 'both' });
    if (this._paused) a.pause();
    this._revealAnims.set(el, a);
    a.onfinish = () => {
      this._revealAnims.delete(el);
      a.cancel(); // release the fill: the inline opacity already holds the end state
      done?.();
    };
  }

  /**
   * Builds the hidden reading layer (`.oim-a11y`) from the document, once per
   * load and per language change: never per frame (trap #10). Painted layers
   * stay aria-hidden; text goes through textContent, never as HTML.
   */
  _buildA11y(): void {
    const viewport = this._viewport;
    if (!viewport || !this.metadata) return;
    const meta: any = this.metadata;
    const principal = (meta.lang && meta.lang[0]) || (meta.languages && meta.languages[0]) || this.lang;
    // Toggle actions hide and show slots at runtime: read what is on screen now.
    const hidden = this._a11yHidden, shown = this._a11yShown;
    const slots = (meta.slots || meta.elements || []).filter(function (s: any) { return !hidden.has(String(s && s.id)); })
      .map(function (s: any) { return shown.has(String(s && s.id)) ? Object.assign({}, s, { style: Object.assign({}, s.style, { isVisible: true }) }) : s; });
    const nodes = a11yNodes(slots, this.lang, principal, !this.disableActions);
    if (this._overlay) this._overlay.setAttribute('aria-hidden', 'true');
    viewport.setAttribute('role', 'figure');
    viewport.setAttribute('aria-label', artworkLabel(meta, nodes, this.lang, principal));
    let box = viewport.querySelector('.oim-a11y') as HTMLElement | null;
    if (!box) {
      box = document.createElement('div');
      box.className = 'oim-a11y';
      box.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
      viewport.appendChild(box);
    }
    box.textContent = '';
    const self = this;
    nodes.forEach(function (n) {
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
        const fire = function () {
          const target = self._overlay && self._overlay.querySelector('[data-slot-id="' + CSS.escape(n.slotId) + '"]');
          if (target) (target as HTMLElement).click();
        };
        el.addEventListener('click', fire);
        // preventDefault stops the browser's own synthetic click, so Enter fires once.
        el.addEventListener('keydown', function (e: KeyboardEvent) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
        });
      }
      box!.appendChild(el);
    });
  }

  /** Slots a toggle action hid or showed, for the screen-reader layer. */
  private _a11yHidden = new Set<string>();
  private _a11yShown = new Set<string>();

  executeToggleState(targetConfig: { hide_slots?: string[]; show_slots?: string[] }): void {
    if (!targetConfig) return;
    const shadow = this.host.shadowRoot;
    if (!shadow) return;

    const self = this;
    const hideSlots = targetConfig.hide_slots || [];
    hideSlots.forEach(function (id) {
      const el = shadow.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;
      if (el) self._hideSlotElement(el);
    });

    const showSlots = targetConfig.show_slots || [];
    showSlots.forEach(function (id) {
      const el = shadow.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;
      if (el) self._showSlotElement(el);
    });

    hideSlots.forEach(function (id) { self._a11yHidden.add(String(id)); self._a11yShown.delete(String(id)); });
    showSlots.forEach(function (id) { self._a11yShown.add(String(id)); self._a11yHidden.delete(String(id)); });
    // Once per action, not per frame.
    this._buildA11y();
  }

  _activeTouchSlot: { el: HTMLElement; leave: () => void } | null = null;

  clearSlots(): void {
    if (this._activeTouchSlot) {
      this._activeTouchSlot = null;
    }
    const layer = this._overlay;
    if (!layer) return;
    if (layer.replaceChildren) {
      layer.replaceChildren();
    } else {
      layer.innerHTML = '';
    }
  }

  setLang(lang: string): void {
    if (this.lang === lang) return;
    const previous = this.lang;
    this.lang = lang;
    this.host.setAttribute('lang', lang);
    this._buildA11y();

    const changes = this._classifyLangChange(previous, lang);
    const hasChange = changes.styleOnly.size > 0 || changes.content.size > 0;

    // Without changes there is no transition: fading to show the same image is
    // a flicker that suggests something happened when nothing did.
    if (!hasChange) {
      this.host.dispatchEvent(new CustomEvent('oim:langchange', { detail: { lang: lang } }));
      return;
    }

    if (this._prefersLessMotion() || this._isLowTierOrMobile()) {
      this._switchWithFade(changes);
    } else {
      this._switchWithBlur(changes);
    }

    this.host.dispatchEvent(new CustomEvent('oim:langchange', { detail: { lang: lang } }));
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
   * The change happens at the PEAK of the blur, not during the ramp.
   *
   * Applying it during the ramp is what looked like the layers stretching:
   * you were watching HOW it changed, half blurred. At the peak nothing is distinguishable,
   * and when focus returns it is already a different image.
   */
  _switchWithBlur(changes: { styleOnly: Set<string>; content: Set<string> }): void {
    const viewport = this._viewport;
    const self = this;
    if (!viewport) { this._applyLangChange(changes); return; }

    viewport.style.transition = 'filter 0.18s ease-out';
    viewport.style.filter = 'blur(14px)';

    setTimeout(function () {
      const ready = self._applyLangChange(changes);
      // Do not refocus until the rebuilt images are loaded: otherwise the blur goes away
      // and the image appears afterwards.
      const cap = new Promise(function (r) { setTimeout(r, 600); });
      Promise.race([ready || Promise.resolve(), cap]).then(function () {
        viewport.style.transition = 'filter 0.32s ease-in-out';
        viewport.style.filter = 'none';
      });
    }, 180);
  }

  /**
   * Alternative for whoever asked for less motion.
   *
   * An opacity fade moves nothing, so it meets the request; and it avoids the abrupt
   * jump right in the area where the eye is looking, which is what removing the transition
   * altogether would leave. Only applied to the layers that change.
   */
  _switchWithFade(changes: { styleOnly: Set<string>; content: Set<string> }): void {
    const shadow = this.host.shadowRoot;
    const self = this;
    const ids = new Set([...changes.styleOnly, ...changes.content]);
    const affected: HTMLElement[] = [];

    if (shadow) {
      ids.forEach(function (id) {
        const el = shadow.querySelector('[data-slot-id="' + id + '"]') as HTMLElement | null;
        // A layer with its own opacity animation changes without a fade: they would fight
        // each other and a flicker nobody could explain would show.
        if (el && !/opacity/i.test(el.style.animationName || '')) affected.push(el);
      });
    }

    affected.forEach(function (el) {
      el.style.transition = 'opacity 0.12s linear';
      el.style.opacity = '0';
    });

    setTimeout(function () {
      self._applyLangChange(changes);
      if (!shadow) return;
      ids.forEach(function (id) {
        const el = shadow.querySelector('[data-slot-id="' + id + '"]') as HTMLElement | null;
        // At its real opacity, not at 1: a layer at 40% would be left fully opaque.
        // The engine already stores that value in dataset.oimOpacity for this same reason.
        if (el) el.style.opacity = el.dataset.oimOpacity !== undefined ? el.dataset.oimOpacity : '1';
      });
    }, 120);
  }

  /** Splits the layers according to what the language changes for them. */
  _classifyLangChange(before: string, after: string): { styleOnly: Set<string>; content: Set<string> } {
    const styleOnly = new Set<string>();
    const content = new Set<string>();
    if (!this.metadata) return { styleOnly, content };
    const slots = (this.metadata.slots || this.metadata.elements || []) as any[];
    slots.forEach(function (slot: any) {
      if (!slot || slot.id === undefined || slot.id === null) return;
      const layerType = compareLangs(slot, before, after);
      if (layerType === 'content') content.add(String(slot.id));
      else if (layerType === 'style-only') styleOnly.add(String(slot.id));

      if (Array.isArray(slot.languages) && !slot.languages.includes('*')) {
        const visibleBefore = slot.languages.includes(before);
        const visibleAfter = slot.languages.includes(after);
        if (visibleBefore !== visibleAfter) {
          styleOnly.add(String(slot.id));
        }
      }
    });
    return { styleOnly, content };
  }

  _applyLangChange(changes: { styleOnly: Set<string>; content: Set<string> }): Promise<void> | null {
    const shadow = this.host.shadowRoot;
    if (shadow && changes.styleOnly.size > 0 && this.metadata) {
      const slots = (this.metadata.slots || this.metadata.elements || []) as any[];
      const self = this;
      slots.forEach(function (slot: any) {
        if (!slot || !changes.styleOnly.has(String(slot.id))) return;
        const el = shadow.querySelector('[data-slot-id="' + slot.id + '"]') as HTMLElement | null;
        if (!el) return;

        if (Array.isArray(slot.languages) && !slot.languages.includes('*')) {
          el.style.display = slot.languages.includes(self.lang) ? '' : 'none';
        }

        // EFFECTIVE values: localizedEntries already applied the background's precedence.
        const e = localizedEntries(slot, self.lang);
        const typo = slot.type === 'text' ? typographyCss(v2LayersOf(self.metadata).get(String(slot.id)), self.lang) : undefined;
        el.style.fontSize = typo?.fontSize ?? e.size;
        el.style.maxWidth = typo?.maxWidth ?? e.maxWidthValue;
      });
    }
    if (changes.content.size > 0) {
      return this.renderSlots({ onlyIds: changes.content });
    }
    return null;
  }

  play(): void {
    this._paused = false;
    // A still player keeps frozen what it built frozen (`_isStill`, the same
    // rule as the infinite loop and the parallax). A card that scrolls into
    // view is "active" and gets play(): it woke the Lottie that
    // `disable-animations` froze on frame 0, and the mobile library spent its
    // scroll animating cards meant to be still (measured in the library).
    if (!this._isStill()) {
      this._animations.forEach(function (a) {
        try { a.play(); } catch (e) { /* the animation died with its node */ }
      });
      if (this._lottieInstances) {
        this._lottieInstances.forEach(function (reg) {
          try { reg.inst.play(); } catch (e) {}
        });
      }
      this._textAnimations.forEach(function (a) { a.play(); });
      this._revealAnims.forEach(function (a) { a.play(); });
      // One-shot timelines resume only if pause() caught them mid-run.
      this._heldTimelines.forEach(function (a) { a.play(); });
      this._heldTimelines.clear();
    }
    if (this._parallaxController) {
      try { this._parallaxController.play(); } catch (e) {}
    }
  }

  pause(): void {
    this._paused = true;
    this._textAnimations.forEach(function (a) { a.pause(); });
    this._revealAnims.forEach(function (a) { a.pause(); });
    const held = this._heldTimelines;
    this._timelines.forEach(function (a) {
      if (a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity) { a.pause(); held.add(a); }
    });
    this._animations.forEach(function (a) {
      try { a.pause(); } catch (e) { /* the animation died with its node */ }
    });
    if (this._lottieInstances) {
      this._lottieInstances.forEach(function (reg) {
        try { reg.inst.pause(); } catch (e) {}
      });
    }
    if (this._parallaxController) {
      try { this._parallaxController.pause(); } catch (e) {}
    }
  }

  /** Registers a timed text animation; one created while paused is born paused. */
  _bornPausedIfNeeded(list: TimedTextAnimation[], a: TimedTextAnimation): void {
    if (this._paused) a.pause();
    list.push(a);
  }

  /** Destroys only the Lottie instances of the given layers, and removes them from the list. */
  _destroyLottiesIn(ids: Set<string>): void {
    if (!this._lottieInstances) return;
    const remaining: Array<{ slotId: string; inst: LottieAnimation }> = [];
    this._lottieInstances.forEach(function (reg) {
      if (ids.has(reg.slotId)) {
        try { reg.inst.destroy(); } catch (e) {}
      } else {
        remaining.push(reg);
      }
    });
    this._lottieInstances = remaining;
  }}


/**
 * Translates the .oim keyframes into the ones WAAPI expects.
 *
 * The transform is composed in the same order as the editor
 * (CanvasArea.tsx:267): translate() rotate() scale(). Changing the order
 * changes the result (it is not commutative).
 *
 * The offsets are in px of design space: the player's overlay IS design space already and
 * scales as one unit, so they scale on their own.
 */
export function keyframesToWaapi(keyframes: any[], duration: number): Keyframe[] {
  return keyframes.map(function (kf) {
    const x = kf.x || 0;
    const y = kf.y || 0;
    const r = kf.r || 0;
    const s = kf.s !== undefined ? kf.s : 1;

    const frame: any = {
      offset: Math.max(0, Math.min(1, kf.t / duration)),
      transform: 'translate(' + x + 'px, ' + y + 'px) rotate(' + r + 'deg) scale(' + s + ')',
    };
    if (kf.o !== undefined) frame.opacity = kf.o;
    if (kf.b !== undefined) frame.filter = kf.b > 0 ? 'blur(' + kf.b + 'px)' : 'none';
    if (kf.e !== undefined) {
      frame.easing = easingToCss(kf.e, 'linear');
    }
    return frame;
  });
}

