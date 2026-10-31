import { OIMRegistry } from '../core/registry.js';
import { getDeviceProfile, type DeviceProfile } from '../core/device-tier.js';
import { fileCache, type VerifyResult, type VerifiedFile } from '../core/file-cache.js';
import { injectStyles } from '../core/styles.js';
import { renderMarkedText, plainOf, type Marks } from '../core/marked-text.js';
import { dropCapStyle, splitDropCap } from '../../../core/src/drop-cap.js';
import { layerTextureMask } from '../../../core/src/effects/texture-mask.js';
import { isEntranceEffect, entranceUnits, entranceStart, entranceKeyframes, entranceClips, ENTRANCE_SECONDS, type EntranceEffect } from '../../../core/src/text-effects.js';
import { loadLottie } from '../core/lottie-loader.js';
import { normalizeRawSlots } from '../core/normalize-raw-slots.js';
import { sanitizeHtml, sanitizeFontFamily } from '../core/security.js';
import { verifyInWorker, type WorkerReply } from '../core/verify-worker.js';
import { extractOIM } from '../core/binary.js';
import { validateOimMetadata, verifyMetadataSignature, securityVerdict, isRefused, ALTERED_FILE_ERROR, isSandboxImageSrc, keyExpiredForFile } from '../core/security.js';
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
} from '../core/layerComposition.js';
import {
  buildWaveKeyframesCss,
  waveCharAnimationDelay,
  WAVE_PERIOD_SECONDS,
  WAVE_KEYFRAMES_NAME,
} from '../core/waveText.js';
import { calculateGlitchState, glitchLayers } from '../../../core/src/glitch.js';
import { easingToCss, revealFrames, revealTiming } from '../../../core/src/reveal.js';
import { calculateTypewriterState } from '../core/typewriterText.js';
import { getFillCss, patternLayerCss, shapeMaskCss, svgSilhouetteMaskCss } from '../core/fill.js';
import { paintPattern } from '../core/patternPaint.js';
import { resolveCssColor, resolvePalette, DYNAMIC_COLOR_ROLES } from '../core/dynamicColors.js';
import { nextWheelZoom, MIN_ZOOM, MAX_ZOOM } from '../core/wheelZoom.js';
import { applyTrimToSvgPaths, ensureTrimKeyframes } from '../core/trimPath.js';
import { ParallaxController } from '../core/ParallaxController.js';
import { oversizeScale } from '../core/oversize.js';
import { shapeDrawing } from '../core/geoShapes.js';
import { frameSilhouette } from '../../../core/src/frame-silhouette.js';
import { mediaFilterCss } from '../../../core/src/media-filters.js';
import { buildSvgNoiseFilter, buildLayerGrainFilter, GRAIN_LAYER_TYPES } from '../core/proceduralNoise.js';
import { TEXTURE_CATALOG, type TexturePreset } from '../core/effects.js';
import { infiniteLayerPlan, TRACK_CLASS, ensureParallaxKeyframes, type InfiniteLayer } from '../core/parallaxCss.js';
import { localizedEntries, isImageContent, compareLangs } from '../core/localizedEntries.js';
import { nodosA11y, etiquetaDeLaObra } from '../core/a11y.js';
import { dropShadowCss, shadowColorCss, shadowFollowsGlyphs } from '../core/shadow.js';
import { cropCss } from '../core/crop.js';
import { montarRellenoDeImagen } from '../core/image-fill.js';
import { flipScale } from '../core/flip.js';
import { isGroup, childrenByGroup, wrapperStyle } from '../core/groups.js';
import { resolveLineHeight, inkMargin } from '../core/typography.js';
import { resolveDimensionToCss, resolveNumericDimension } from '../core/dimensions.js';
import { slotClipping } from '../core/clipping.js';
import {
  whatTheReaderCannotDo,
  describeMissing,
  CONTRACT_VERSION,
  PLAYER_CAPABILITIES,
} from '../core/compatibility.js';
import { bindStates, resolveActions, applyMinHitArea, readInteraction, type ActionRunner, type RegisterOutsideTap } from './states.js';
import { resolveMode } from '../core/modes.js';
import { buildArtisticTextModelFromSlot, generateArtisticTextSvgString } from '../core/artisticText.js';
import { readEmbeddedFonts, registerEmbeddedFonts, embeddedFontFamily } from '../core/embeddedFonts.js';

/**
 * Sustituye el content de `hoverWrap` por un <span> por carácter, cada uno
 * con la animación de ola desfasada según su índice.
 *
 * Se declara la animación en CSS y la interpola el navegador — no hay bucle de
 * rAF ni keyframes muestreados. El @keyframes en sí lo inyecta
 * ensureWaveKeyframes() una sola vez por shadow root.
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
    // Un espacio normal dentro de un inline-block se colapsa y la letra
    // siguiente se pega; el no-breaking space conserva el hueco.
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

/** Inyecta el @keyframes de la ola una sola vez por shadow root. La regla es
 *  idéntica para todos los slots, así que no se duplica por slot. */
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

interface ImageEngineOptions {
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

function getTouchDistance(touches: TouchList): number {
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

  // El marco vive en coordenadas de LIENZO, no en la caja del slot.
  //
  // Antes era `width/height: 100%` dentro del slot, que es un container flex
  // con align-items/justify-content pensados para text: el SVG no llenaba el
  // slot y quedaba centrado, dejando una franja del lienzo sin cubrir arriba
  // -medido en el visor real: 22.4px-. Ademas el marco solo podia tapar lo que
  // media la mascara. Sacarlo del flujo con position:absolute lo desacopla del
  // layout de text, y anclarlo en (-x, -y) lo pone en el origen del lienzo.
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
        // Siempre evenodd: los tres subtrazados —lienzo, caja y silueta— lo
        // exigen. Ya no depende de maskInvert ni de maskMode.
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
 * Decide si el SVG de fondo se pinta como mosaico repetido o como escena a
 * sangre.
 *
 * `tile` es el comportamiento histórico y DEBE seguir siendo el valor por
 * defecto: los .oim exportados antes del motor generativo no llevan
 * `backgroundFit`, y son todos patrones de íconos que se repiten. Cambiar ese
 * default rompería cualquier archivo ya publicado.
 *
 * `backgroundType === 'generative'` infiere `cover` como red de seguridad para
 * archivos horneados por una versión del editor que aún no escribía el campo.
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
 * -> attach path can be exercised in isolation. The invariant that matters and
 * that has no other guard: for a project using NEITHER masks NOR filters, the
 * children appended to the fragment must match the input slot list one-to-one
 * and in the same order. A restructure once silently dropped zone-less slots
 * from the DOM and only human review caught it.
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

export class ImageEngine {
  host: HTMLElement;
  metadata: any = null;
  /** File trust state: no_metadata | unsigned | verified | invalid_signature | corrupt */
  securityStatus: string = 'unsigned';
  /** Family -> internal name of the fonts shipped inside this file. */
  embeddedFontFamilies: Map<string, string> = new Map();
  imageUrl: string | null = null;
  lang: string;
  showControls: boolean;
  activeSlotId: string | null = null;
  zoom = 1;
  panX = 0;
  panY = 0;
  _stage: HTMLElement | null = null;
  _viewport: HTMLElement | null = null;
  _baseImg: HTMLImageElement | null = null;
  _overlay: HTMLElement | null = null;
  _lottieInstances: Array<{ slotId: string; inst: LottieAnimation }> = [];
  /** El controlador vivo. Se guarda para poder destruirlo y reapuntarlo. */
  _parallaxController: ParallaxController | null = null;
  /** Los listeners de arrastre en `window`, para poder quitarlos al destruir. */
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

  allowZoom: boolean;
  showLanguageSelector: boolean;
  showSlots: boolean;
  allowLottie: boolean;
  allowDynamicColors: boolean = true;
  disableAnimations: boolean;
  disableActions: boolean;
  dropdownBlur: boolean;
  fit: 'contain' | 'cover';
  align: 'center' | 'top' | 'bottom';
  _deviceProfile: DeviceProfile;

  constructor(host: HTMLElement, opts?: ImageEngineOptions) {
    const options = opts || {};
    this.host = host;
    this.lang = host.getAttribute('lang') || 'es';
    this.showControls = host.getAttribute('show-controls') !== 'false';
    this._deviceProfile = getDeviceProfile();
    
    this.allowZoom = options.allowZoom === true;
    this.showLanguageSelector = options.showLanguageSelector !== false;
    this.showSlots = options.showSlots !== false;
    this.allowLottie = options.allowLottie !== false && host.getAttribute('allow-lottie') !== 'false';
    // Colores dinamicos. Por defecto ACTIVO, como `allow-lottie`: si una web
    // se ha molestado en definir `--oim-color-*`, los quiere. Este atributo
    // sirve para eximir imagenes concretas -- una obra publica de otro autor
    // no tiene por que adoptar tu paleta.
    //
    // No hace falta apagarlo para el caso comun: la funcion ya es opt-in a
    // nivel de pagina, porque `var(--oim-color-x, respaldo)` cae al respaldo
    // del autor si la web no define la variable.
    this.allowDynamicColors =
      options.allowDynamicColors !== false && host.getAttribute('allow-dynamic-colors') !== 'false';
    
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Las dos banderas salen de `core/modos.ts`, que es el UNICO sitio donde
    // se decide. Tenerlo tambien aqui significaria que el player se configura
    // de una forma al montarse y de otra al cambiarle un atributo en caliente.
    const mode = resolveMode(host as any, options, prefersReducedMotion);
    this.disableAnimations = mode.disableAnimations;
    this.disableActions = mode.disableActions;
    this.dropdownBlur = options.dropdownBlur !== false && host.getAttribute('dropdown-blur') !== 'false';
    this.fit = options.fit || 'contain';
    this.align = options.align || 'center';
  }

  /**
   * Escribe `--oim-palette-<rol>` en el visor con la paleta efectiva: el
   * atributo `palette`, si no, dark/light segun prefers-color-scheme, si no
   * defaultPalette. Con allow-dynamic-colors="false" no escribe ninguna.
   */
  aplicarPaleta(): void {
    const viewport = this._viewport as HTMLElement | null;
    if (!viewport) return;
    const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    const paleta = this.allowDynamicColors
      ? resolvePalette(this.metadata ?? {}, { requested: this.host.getAttribute('palette'), prefersDark })
      : null;
    for (const role of DYNAMIC_COLOR_ROLES) {
      const valor = paleta?.colors[role];
      if (valor) viewport.style.setProperty('--oim-palette-' + role, valor);
      else viewport.style.removeProperty('--oim-palette-' + role);
    }
  }

  destroy(): void {
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._onFullscreenChange) {
      document.removeEventListener('fullscreenchange', this._onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', this._onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', this._onFullscreenChange);
    }
    if (this._lottieInstances) {
      this._lottieInstances.forEach(function (reg) {
        try { reg.inst.destroy(); } catch (e) {}
      });
      this._lottieInstances = [];
    }
    this._animations.forEach(function (a) {
      try { a.cancel(); } catch (e) { /* la animación ya murió con su nodo */ }
    });
    this._animations = [];
    this._timelines.clear();
    this._revealAnims.clear();
    this._heldTimelines.clear();
    this._textAnimations.forEach(function (a) {
      try { a.stop(); } catch (e) {}
    });
    this._textAnimations = [];
    // El controlador de parallax tiene su propio bucle de rAF y su propio
    // listener en `window`: sin esto seguian vivos despues de quitar el player
    // del documento, uno por cada tarjeta de un feed.
    if (this._parallaxController) {
      try { this._parallaxController.destroy(); } catch (e) {}
      this._parallaxController = null;
    }
    if (this._onDragMove) {
      window.removeEventListener('mousemove', this._onDragMove);
      this._onDragMove = null;
    }
    if (this._onDragEnd) {
      window.removeEventListener('mouseup', this._onDragEnd);
      this._onDragEnd = null;
    }
  }

  async load(src: Blob | string): Promise<boolean> {
    const host = this.host;
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });

    try {
      // Set image URL instantly to enable native progressive rendering from the OIM/PNG URL
      if (typeof src === 'string') {
        this.imageUrl = src;
      } else {
        if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.imageUrl);
        }
        this.imageUrl = URL.createObjectURL(src);
      }

      host.classList.add('oim-player-host');
      host.classList.add('oim-align-' + this.align);
      host.classList.add('oim-tier-' + this._deviceProfile.tier);
      if (this._deviceProfile.isMobile) host.classList.add('oim-mobile');

      // Render the image canvas instantly so the base PNG displays with no delay
      shadow.innerHTML =
        '<div class="oim-player-viewport oim-fit-' + this.fit + '" part="viewport">' +
          '<img class="oim-player-base" crossorigin="anonymous" src="' + this.imageUrl + '" alt="" aria-hidden="true" part="base" />' +
          '<div class="oim-layer-overlay" aria-hidden="true" part="overlay"></div>' +
        '</div>';

      injectStyles(shadow);

      this._viewport = shadow.querySelector('.oim-player-viewport');
      this._baseImg = shadow.querySelector('.oim-player-base');
      this._overlay = shadow.querySelector('.oim-layer-overlay');
      this._stage = this.host;

      // Colores dinamicos apagados para ESTA imagen: se neutralizan los ocho
      // roles en el visor. Poner una propiedad personalizada a `initial` hace
      // que `var(--x, respaldo)` caiga al respaldo -- comprobado en navegador.
      //
      // Se apaga aqui, en el visor, y no filtrando en cada llamada de color:
      // asi da igual cuantos sitios pinten color hoy o manana.
      if (!this.allowDynamicColors && this._viewport) {
        for (const role of DYNAMIC_COLOR_ROLES) {
          (this._viewport as HTMLElement).style.setProperty('--oim-color-' + role, 'initial');
        }
      }
      this.aplicarPaleta();

      // Si el usuario tiene activo 'prefers-reduced-motion: reduce', no se aplica
      // el desenfoque de 14px sino que se mantiene en 'none' (transicionando solo opacidad).
      if ((this._prefersLessMotion() || this._isLowTierOrMobile()) && this._viewport) {
        (this._viewport as HTMLElement).style.filter = 'none';
      }

      const self = this;

      let resizeRaf: number | null = null;
      const handleResize = () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
          self.updateViewportSize();
          self.updateScale();
          resizeRaf = null;
        });
      };

      if (typeof ResizeObserver !== 'undefined' && this._viewport) {
        if (this._resizeObserver) {
          this._resizeObserver.disconnect();
        }
        this._resizeObserver = new ResizeObserver(handleResize);
        this._resizeObserver.observe(this.host);
      }


      this._onFullscreenChange = handleResize;
      document.addEventListener('fullscreenchange', this._onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
      document.addEventListener('mozfullscreenchange', this._onFullscreenChange);
      document.addEventListener('MSFullscreenChange', this._onFullscreenChange);

      const imgNode = this._baseImg;
      const viewportNode = this._viewport;

      function lockAspectRatio() {
        if (viewportNode && imgNode && imgNode.naturalWidth > 0) {
          viewportNode.style.setProperty(
            '--oim-ar',
            imgNode.naturalWidth + ' / ' + imgNode.naturalHeight
          );
          self._baseImg = imgNode;
          self.updateViewportSize();
          self.updateScale();
          if (self.metadata) {
            self.renderSlots();
          }
        }
      }

      if (imgNode && imgNode.complete && imgNode.naturalWidth > 0) {
        lockAspectRatio();
      } else if (imgNode) {
        imgNode.onload = lockAspectRatio;
      }

      this.updateViewportSize();
      this.updateScale();
      this._bindViewportEvents();

      // Fetch the blob and extract OIM metadata in the background
      const blobPromise = fileCache.getBlob(src);

      return blobPromise.then((blob) => {
        return new Promise<boolean>((resolve2, reject2) => {
          OIMRegistry.requestRender(self, blob, src, resolve2, reject2);
        });
      }).catch((err) => {
        console.error('[OimPlayer::ImageEngine::load]', err);
        if (String(err && err.message).indexOf(ALTERED_FILE_ERROR) === 0) {
          // An altered file is not shown. The base image was painted before
          // verification, for fast progressive loading, so it has to go now.
          shadow.innerHTML = '<div class="oim-player-error oim-player-refused" part="error"></div>';
          injectStyles(shadow);
          const box = shadow.querySelector('.oim-player-error') as HTMLElement | null;
          if (box) box.textContent = 'Archivo alterado: no coincide con su firma. OIM no lo muestra.';
        }
        host.dispatchEvent(new CustomEvent('error', { detail: err }));
        throw err;
      });
    } catch (err: any) {
      console.error('[OimPlayer::ImageEngine]', err);
      shadow.innerHTML = '<div class="oim-player-error" part="error"></div>';
      const errorDiv = shadow.querySelector('.oim-player-error') as HTMLElement;
      if (errorDiv) {
        errorDiv.textContent = 'Error cargando OIM: ' + err.message;
      }
      host.dispatchEvent(new CustomEvent('error', { detail: err }));
      return false;
    }
  }

  async _verifyMainThread(blob: Blob): Promise<VerifyResult> {
    const extracted = await extractOIM(blob);
    if (!extracted.metadata) {
      return { metadata: { slots: [] }, security: 'no_metadata', announce: false };
    }
    const errs = validateOimMetadata(extracted.metadata);
    if (errs.length > 0) {
      return { refused: true, security: 'corrupt', error: 'Corrupted or tampered OIM file: ' + errs[0] };
    }
    const isSigned = !!(extracted.metadata.signature && extracted.metadata.key_version);
    const isSigValid = await verifyMetadataSignature(extracted.metadata);
    const keyExpired = isSigned && isSigValid ? await keyExpiredForFile(extracted.metadata) : false;
    // Decided on the ORIGINAL metadata, before any branch strips it.
    const status = securityVerdict({ isSigned, isSigValid, keyExpired, metadata: extracted.metadata, imageHash: extracted.imageHash });
    if (isRefused(status)) {
      return { refused: true, security: status, error: ALTERED_FILE_ERROR + ': ' + status };
    }
    let metadata: any;
    let announce = false;
    if (!isSigValid) {
      metadata = { slots: [] };
    } else if (status === 'unsigned' || status === 'expired_key') {
      metadata = { slots: [], elements: [], layers: [] };
    } else {
      // First, before normalizing anything: announce what is not understood.
      //
      // The format degrades gracefully — unknown keys survive `passthrough`,
      // so a newer file does not crash an older player — but it previously
      // degraded IN SILENCE. The schema declares capabilities that this
      // player does not implement; a file using them would render poorly without
      // its author being able to distinguish this from their own mistake.
      //
      // Only for ACCEPTED files: if the signature is invalid or the domain is
      // blocked, nothing is rendered, and discussing capabilities there would
      // distract from the real issue.
      announce = true;
      // Normalize Python backend format AFTER signature validation (mutation before would break sig check).
      normalizeRawSlots(extracted.metadata);
      metadata = extracted.metadata;
    }
    return { metadata, security: status, announce };
  }

  async _verifyWithWorker(blob: Blob): Promise<VerifyResult> {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let res: WorkerReply;
    try {
      res = await verifyInWorker(blob, hostname, origin);
    } catch (err) {
      console.warn('[OimPlayer] Web Worker unavailable or crashed (possibly blocked by CSP). Falling back to main-thread execution.', err);
      return this._verifyMainThread(blob);
    }
    if (res.success) {
      return { metadata: res.metadata, security: res.security || 'unsigned', announce: true };
    }
    if (res.refused) {
      // Not a worker failure: the file was altered. Retrying on the main
      // thread would reach the same verdict, so it is refused here.
      return { refused: true, security: res.security as string, error: res.error as string };
    }
    console.warn('[OimPlayer] Web Worker reported execution failure. Falling back to main-thread execution.', res.error);
    return this._verifyMainThread(blob);
  }

  async _verify(blob: Blob): Promise<VerifyResult> {
    if (typeof Worker === 'undefined') {
      return this._verifyMainThread(blob);
    }
    return this._verifyWithWorker(blob);
  }

  /**
   * Applies verified metadata to this player. Both worker and main-thread
   * verification paths delegate here, making this the single application point
   * for both paths. Which path is taken is decided by the browser environment;
   * a warning or side effect that only exists on one path would appear or not
   * depending on where the file is opened, which is worse than not having it:
   * the issue seems to come and go.
   *
   * Both paths execute:
   * 1. self._announceUnsupported(this.metadata)
   * 2. registerEmbeddedFonts(readEmbeddedFonts(this.metadata))
   */
  async _applyVerified(v: VerifiedFile): Promise<boolean> {
    const self = this;
    this.metadata = structuredClone(v.metadata);

    // A PUBLIC file carries its own stamp. Showing it with the same green
    // badge as an authored file ("Signature verified") would promise too much:
    // anyone can take a public file, alter a number, re-sign it, and it would
    // appear just as verified. The signature still guarantees the same thing
    // — that nobody touched it after signing; what it does not guarantee is
    // that it is the original file.
    this.securityStatus = v.security;
    if (this.securityStatus === 'unsigned') {
      try { this.host.setAttribute('data-oim-sin-firma', ''); } catch (e) {}
      console.warn('[OimPlayer] Unsigned file: painting the base image only. Interactive layers need a signature.');
    }
    if (this.securityStatus === 'expired_key') {
      try { this.host.setAttribute('data-oim-clave-retirada', ''); } catch (e) {}
      console.warn('[OimPlayer] Esta obra se firmó con una clave retirada. Pide al autor que la vuelva a exportar.');
    }
    if (v.announce) {
      self._announceUnsupported(this.metadata);
    }

    // Fonts shipped inside the file are registered before the first paint, so
    // no layer asks Google for a family the file already carries.
    this.embeddedFontFamilies = await registerEmbeddedFonts(readEmbeddedFonts(this.metadata));

    this.updateViewportSize();
    this.updateScale();
    await this.renderSlots();

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        if (self.host && self._overlay) {
          self.updateViewportSize();
          self.updateScale();
          const nodes = self._overlay.querySelectorAll('.oim-slot');
          nodes.forEach((node: any) => {
            const oldTransition = node.style.transition;
            node.style.setProperty('transition', 'none', 'important');
            const voidOffset = node.offsetWidth; 
            node.style.transition = oldTransition;
          });
        }
      });
    }

    this.host.dispatchEvent(new CustomEvent('oim:loaded', {
      detail: { type: 'image', metadata: this.metadata, security: this.securityStatus },
    }));
    return true;
  }

  async _executeLoad(blob: Blob, src?: string | Blob): Promise<boolean> {
    try {
      const v = await fileCache.getVerified(src ?? blob, (b) => this._verify(b));
      if (v.refused) {
        this.securityStatus = v.security;
        throw new Error(v.error);
      }
      return this._applyVerified(v);
    } catch (err) {
      console.error('[OimPlayer::ImageEngine::_executeLoad]', err);
      throw err;
    }
  }

  /**
   * Cuenta lo que este player no puede honrar del archivo.
   *
   * NO lanza ni deja de pintar: el formato degrada a PNG por diseno, y un
   * `.oim` que no se entiende del todo sigue siendo una imagen valida. Esa red
   * es algo que Rive y Lottie no tienen, y rechazar cambiaria una perdida
   * parcial por una total.
   *
   * Se cuenta por tres sitios porque hay tres publicos distintos: la consola
   * para quien depura, un atributo en el anfitrion para quien inspecciona el
   * DOM, y un evento para quien incrusta el player y quiere reaccionar.
   *
   * Y se calla cuando no hay nada que decir. Un actionEvent que salta con los
   * archivos normales -los que no traen `min_player`, o sea todos los
   * publicados hasta hoy- se vuelve ruido de fondo, y entonces nadie lo lee el
   * dia que dice algo.
   */
  _announceUnsupported(metadata: any): void {
    let missing;
    try {
      missing = whatTheReaderCannotDo(metadata, {
        version: CONTRACT_VERSION,
        capabilities: PLAYER_CAPABILITIES,
      });
    } catch (e) {
      return; // Avisar de una incompatibilidad no puede ser lo que rompa nada.
    }
    if (!missing.hayAlgoQueDecir) return;

    const message = describeMissing(missing);
    try { console.warn('[OimPlayer] ' + message); } catch (e) { /* consola ajena */ }

    try {
      if (missing.missingCapabilities && missing.missingCapabilities.length > 0) {
        this.host.setAttribute('data-oim-sin-soporte', missing.missingCapabilities.join(' '));
      }
      if (missing.missingRequiredCapabilities && missing.missingRequiredCapabilities.length > 0) {
        this.host.setAttribute('data-oim-requeridas-faltantes', missing.missingRequiredCapabilities.join(' '));
      }
      if (missing.versionTooOld && missing.requiredVersion) {
        this.host.setAttribute('data-oim-version-exigida', missing.requiredVersion);
      }
      this.host.dispatchEvent(new CustomEvent('oim:incomplete', {
        bubbles: true, composed: true,
        detail: { mensaje: message, ...missing },
      }));
      if (missing.cannotRender) {
        this.host.dispatchEvent(new CustomEvent('oim:unsupported', {
          bubbles: true, composed: true,
          detail: { mensaje: message, ...missing },
        }));
      }
    } catch (e) { /* un anfitrion que no admite atributos no debe tumbar la carga */ }
  }

  updateScale(): void {
    if (!this._viewport) return;
    // Layout width: no transform in it (neither the player's zoom nor a
    // parent's), so nothing to divide back out.
    const untransformedWidth = this._viewport.offsetWidth;
    const canvasWidth = this.metadata && this.metadata.canvas ? (this.metadata.canvas.natural_width || this.metadata.canvas.width) : 0;
    const designWidth = (this.metadata && (this.metadata.artboardWidth || this.metadata.canvasWidth || this.metadata.canvas_width)) || canvasWidth || (this._baseImg && this._baseImg.naturalWidth) || 1080;
    const scale = untransformedWidth / designWidth;
    // `--oim-fit`, no `--oim-scale`.
    //
    // Son dos conceptos distintos y compartian nombre: aqui es el factor de
    // AJUSTE del documento a la caja del anfitrion, y en la linea ~2272 es la
    // scale PROPIA de una forma. Como esta se pone en el visor, viajaba por
    // herencia hasta cada `.oim-slot`, cuya regla hace
    // `scale(var(--oim-scale, 1))` esperando un 1 — y `var(--x, 1)` solo cae
    // en el 1 si la variable NO EXISTE en toda la cadena, no si nadie se la
    // dio a esa caja. Resultado: el ajuste se aplicaba dos veces, en el
    // overlay y otra vez en cada slot, y todo salia un 20 % pequeno. Medido
    // sobre un .oim real: una forma de 140px se pintaba a 90 en vez de a 112.
    this._viewport.style.setProperty('--oim-fit', scale.toFixed(6));
  }

  updateViewportSize(): void {
    if (!this._viewport) return;
    let imgWidth = this._baseImg ? this._baseImg.naturalWidth : 0;
    let imgHeight = this._baseImg ? this._baseImg.naturalHeight : 0;
    
    if (imgWidth === 0 && this.metadata && this.metadata.canvas) {
      imgWidth = this.metadata.canvas.natural_width || this.metadata.canvas.width || 1080;
      imgHeight = this.metadata.canvas.natural_height || this.metadata.canvas.height || 1920;
    }
    
    if (imgWidth === 0) return;

    // The layout box, not the on-screen rectangle: getBoundingClientRect
    // includes a parent's transforms, so inside a 3D carousel card (or any
    // scaled container) the image was sized for a box bigger than its own and
    // came out zoomed. offsetWidth/Height ignore transforms.
    const containerWidth = this.host.offsetWidth;
    const containerHeight = this.host.offsetHeight;
    if (containerWidth === 0 || containerHeight === 0) {
      if (!this._retryViewportSize) {
        this._retryViewportSize = true;
        const self = this;
        setTimeout(() => {
          self._retryViewportSize = false;
          self.updateViewportSize();
          self.updateScale();
        }, 100);
      }
      return;
    }

    const ar = imgWidth / imgHeight;
    const containerAr = containerWidth / containerHeight;

    let width, height;

    if (this.fit === 'cover') {
      if (containerAr > ar) {
        width = containerWidth;
        height = containerWidth / ar;
      } else {
        height = containerHeight;
        width = containerHeight * ar;
      }
    } else { 
      if (containerAr > ar) {
        height = containerHeight;
        width = containerHeight * ar;
      } else {
        width = containerWidth;
        height = containerWidth / ar;
      }
    }

    this._viewport.style.width = Math.round(width) + 'px';
    this._viewport.style.height = Math.round(height) + 'px';
  }

  async renderSlots(options?: { onlyIds?: Set<string> }): Promise<void> {
    if (!this.metadata || !this.host) return;

    const allSlots = (this.metadata.slots || this.metadata.elements || []) as any[];
    // La composicion (mascaras y filtros) se calcula sobre la pila entera, asi
    // que no admite parches: si la hay, se reconstruye todo.
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

    // Overlay de textura en el lienzo (Spec 2026-10-07 / metadata.effects o metadata.grain)
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
    // Normalizacion de parallax: si viaja dentro de style y la raiz no lo tiene, copiarlo a la raiz.
    // Un solo punto de entrada para que todo el motor y controladores lean de s.parallax.
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

    // Que grupos traen hijos EN ESTE archivo. Se calcula antes de construir
    // ningun elemento porque decide si el grupo llega a existir en el DOM:
    // un grupo sin hijos no se pinta, igual que hasta ahora.
    const groupChildren = childrenByGroup(slots);

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
      // `isMaskLayer` desaparecio al convertir la mascara en un tipo propio.
      // Una mascara en mode troquel solo recorta: no emite nodo visible. La de
      // mode ventana SI se pinta —es el marco— y por eso queda fuera de esta
      // guarda.
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
      // La mascara dedicada en mode "ventana" es una capa que se pinta: un
      // En mode imagen NADA es interactivo, y por eso se corta aqui y no mas
      // abajo: esta bandera decide tambien el area minima de contacto y el
      // dimensionado. Un slot que no se puede pulsar no necesita ni lo uno ni
      // lo otro.
      const isInteractiveSlot = !self.disableActions
        && (slot.isInteractive === true || style.isInteractive === true || Boolean(slot.states || style.states));
      const isWindowMask = slotType === 'mask' && style.maskMode !== 'cutout';
      const isArtisticText = slotType === 'artistic-text';
      const isGeoLike = slotType === 'geo' || slotType === 'shape' || slotType === 'draw' || slotType === 'filter' || slotType === 'container' || isWindowMask || isInteractiveSlot || isArtisticText;

      // Un grupo CON hijos si produce elemento: es el wrapper de la fase 3.
      //
      // Hasta aqui el grupo no llegaba nunca: `group` no esta en `isGeoLike`,
      // asi que un slot sin text se descartaba en esta linea y el player no
      // pintaba nada. El peso muerto del grupo estaba en el ARCHIVO firmado,
      // no en el DOM — el diagnostico del diseno decia lo contrario y se
      // comprobo aqui.
      //
      // La condicion es «con hijos» y no «es un grupo» porque asi los archivos
      // anteriores a la fase 3, que no traen `style.groupId` en ningun slot,
      // producen EXACTAMENTE el mismo DOM que hoy: sin hijos que anidar, el
      // wrapper no tendria nada dentro y solo seria una capa de mas.
      const isBackgroundSlot = slot.is_background_pattern === true || slot.id === 'background-pattern-slot';
      const isWrapperWithChildren = slotType === 'group' && groupChildren.has(String(slot.id));
      if (isWrapperWithChildren) {
        // Cae directo al armado del elemento, saltandose la guarda de abajo:
        // un wrapper no tiene content propio que ensenar.
      } else if (slotType === 'pattern' || isBackgroundSlot) {
        // Cae directo al armado del elemento: una capa de patron o fondo no trae
        // `content`, su CSS lo pone `patternLayerCss` o `isBackgroundSlot` mas abajo.
      } else if (!rawText && !(isGeoLike && (style.fillColor || style.fillType || style.width || slotType === 'filter' || slotType === 'container' || isWindowMask || isInteractiveSlot || isArtisticText))) return null;

      const isImageSlot = isImageContent(slot, rawText);

      // Inline <svg> tags in content are always allowed (local shapes);
      // Las URL externas ya no se cargan: el player solo acepta `data:`.
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
            // preserveAspectRatio drive proportional scaling — 1:1 with editor.
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
            // Con `setProperty`, no concatenando el atributo `style`. Ese color
            // sale del .oim y NO lo valida el esquema, asi que al pegarlo en el
            // atributo el navegador lo parsea como lista de declaraciones: un
            // `strokeColor` de "red; background-image: url(https://…)" colaba
            // una peticion a un tercero al abrir un archivo ajeno. El CSSOM
            // rechaza el valor entero si no es un color valido -- comprobado en
            // navegador: por atributo inyecta, por CSSOM no.
            //
            // La asignacion de `color` de arriba ya era segura; esta linea la
            // sobrescribia y reintroducia el agujero.
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

      // Visibilidad selectiva por idioma (regla languages: ["*"] | ["es", ...])
      if (Array.isArray(slot.languages) && !slot.languages.includes('*') && !slot.languages.includes(self.lang)) {
        slotEl.style.display = 'none';
      }

      // Efectos visuales de capa (resplandor neón)
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

      // Capa `pattern`: tesela y se mueve, con el CSS que calcula el core.
      // NO es el fondo del lienzo -`isBackgroundSlot`, arriba-: esa marca
      // estira al 100% del visor, y una capa de patron tiene su propia
      // posicion y tamano. El player no calcula este CSS por su cuenta: lo
      // unico que hace es aplicarlo tal cual lo devuelve `patternLayerCss`.
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
      if (slotType === 'text' && style.fillType && style.fillType !== 'none') {
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
        // 'cover' es el default del EDITOR al crear una figura de imagen. Este
        // default solo aplica a archivos antiguos: hasta que se corrigio
        // serializeSlots, `objectFit` no viajaba al .oim, asi que el visor caia
        // aqui y dibujaba 'contain' donde el editor mostraba 'cover'. Los
        // archivos nuevos traen el valor explicito y no dependen de esta linea;
        // igualarla al editor alinea de paso los ya exportados.
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

        const model = buildArtisticTextModelFromSlot(slot, self.lang);
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
        // Ojo: esta rama es el `else` del camino de HTML sanitizado, así que un
        // slot de text autorado con HTML/SVG rico se renderiza SIN ola aunque
        // tenga textAnimationType === 'wave-chars' — deliberado: no partimos
        // HTML arbitrario carácter a carácter.
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

      // Parallax infinito: si la capa se desplaza en bucle, envolver en la pista
      // con 2 copies segun infiniteLayerPlan. Solo se duplica si se mueve (duplicate: true).
      const parallaxCfg = slot.parallax || style.parallax;
      let duplicatedForInfinite = false;

      if (parallaxCfg && parallaxCfg.enabled) {
        const inf = parallaxCfg.infinite || {};

        // El bucle APAGADO es velocidad cero, no velocidad por defecto.
        //
        // `parallaxCfg.enabled` dice que la CAPA tiene parallax; `inf.enabled`
        // dice si esa capa se desplaza en bucle. Son cosas distintas y hay que
        // mirar las dos: una capa con parallax y el bucle apagado -la montana y
        // la cabana quietas delante del cielo en movimiento- llegaba aqui con su
        // `speedPxSec` intacto y acababa duplicada y desfilando.
        //
        // Es la regla central del diseno -"solo se duplica lo que se mueve"-
        // incumplida por el lector. Ninguna prueba podia verla: las del
        // generador puro reciben la velocidad ya calculada, y nadie cubria el
        // tramo que traduce la configuracion del archivo a esa velocidad.
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
        // El ancho del LIENZO va tambien: decide cuantas piezas hacen falta
        // para que la pista lo cubra durante toda la vuelta. Sin el, una capa
        // mas estrecha que el lienzo deja bandas vacias a los lados.
        const plan = infiniteLayerPlan(layerCfg, slotW || baseWidth, baseWidth);

        if (plan.duplicate) {
          duplicatedForInfinite = true;
          ensureParallaxKeyframes(self.host.shadowRoot);

          const track = document.createElement('div');
          track.className = TRACK_CLASS;
          for (const [k, v] of Object.entries(plan.container)) {
            track.style.setProperty(k, v);
          }

          // Cuantas piezas y cuales se reflejan lo decide el PLAN. Con espejo
          // son cuatro -A, espejo(A), A, espejo(A)- porque el desplazamiento es
          // de -50% de la pista: con solo dos, al final de la vuelta se ve
          // espejo(A) donde empezo A y el reinicio SALTA.
          for (let i = 0; i < plan.copies; i++) {
            const piece = (i === 0 ? loopWrap : loopWrap.cloneNode(true)) as HTMLElement;
            // El ancho lo decide el plan, no este archivo: la pista es
            // `width: max-content` y una pieza con ancho en porcentaje
            // colapsaria dejandolas superpuestas.
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

      // Trim path: si el slot tiene trimStart/trimEnd, aplicar stroke-dasharray
      // a los <path> SVG inline una vez montados en el DOM.
      // `trimDuration` entra en la condicion a proposito: un icono con
      // trimStart 0 y trimEnd 100 no recorta nada, pero SI se anima, y es el
      // caso mas habitual — dibujar el icono entero de principio a fin.
      if (hasHtmlOrSvg && (style.trimStart || (style.trimEnd != null && style.trimEnd < 100) || style.trimDuration)) {
        if (style.trimDuration) ensureTrimKeyframes(self.host.shadowRoot);
        applyTrimToSvgPaths(hoverWrap, style);
      }
      
      const fontSize: string = localized.size;
      // Only layers that paint text need a font. serializeSlots writes
      // fontFamily "Inter" on EVERY layer, images included, so without this
      // any .oim with an image asked Google for Inter when opened.
      const paintsText = isArtisticText || (!isImageSlot && !isSvg && slotType !== 'lottie' && text.trim() !== '');
      if (style.fontFamily && paintsText) {
        const safeFontFamily = sanitizeFontFamily(style.fontFamily);
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
 
      slotEl.style.maxWidth = maxWidth;
      slotEl.style.fontSize = fontSize;
      // Sin unidad: se hereda como factor, asi que un hijo con otro size de
      // fuente calcula SU alto de linea y no arrastra el del padre.
      slotEl.style.lineHeight = String(resolveLineHeight(style));

      if (slotType === 'svg' || isSvg) {
        const vectorColor = resolveCssColor(style.strokeColorRole || style.fillColorRole, style.strokeColor);
        if (vectorColor) {
          slotEl.style.setProperty('color', vectorColor);
        }
      } else if (slotType === 'text' && (style.fillColor || style.fillColorRole || style.colorRole)) {
        // En un texto `fillColor` ES la letra (contrato 1.5.0: `color` se
        // retiro y el compilador lo convierte en `fillColor`). Aqui se leia
        // `style.color`, asi que un texto nuevo del editor -`fillColor` sin
        // `fillType`- salia firmado sin color. Un relleno con mascara
        // (degradado, patron) lo pisa despues con `color: transparent`.
        const resolvedTextColor = resolveCssColor(style.fillColorRole || style.colorRole, style.fillColor);
        if (resolvedTextColor) {
          slotEl.style.setProperty('color', resolvedTextColor);
        }
      }

      // El RELLENO del text: degradado, patron o fondo generativo.
      //
      // `getFillCss` contemplaba el text desde el principio -devuelve
      // `background-clip: text` para esos tres tipos- pero NADIE lo llamaba
      // para un slot de text: su unica llamada en todo el monorepo era para
      // `slotType === 'container'`. La rama existia y era inalcanzable, y por
      // eso ningun .oim publicado usa text con degradado: no es que el editor
      // no lo ofreciera, es que nadie lo pintaba.
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
          const inkPad = inkMargin(resolveLineHeight(style));
          if (inkPad > 0) {
            slotEl.style.setProperty('padding-top', inkPad + 'em', 'important');
            slotEl.style.setProperty('padding-bottom', inkPad + 'em', 'important');
          }
        } else {
          Object.assign(slotEl.style, textFill);
          if (isMaskFill) {
            const inkPad = inkMargin(resolveLineHeight(style));
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
      // Una mascara de ventana NO lleva fondo: su color va en el marco SVG y
      // el hueco debe quedar transparente para que se vea lo de detras.
      // `isGeoLike` responde a DOS preguntas a la vez —«se pinta fondo?» y
      // «necesita caja y area de contacto?»— y los slots interactivos entraron
      // por la segunda. Se llevaron la primera de propina: un TEXTO interactivo
      // recibia como fondo el color de su propia letra, porque en una capa de
      // text `fillColor` ES el color de la letra. Salia un bloque liso con el
      // text dentro, invisible.
      //
      // Encontrado en un .oim real el 28 de agosto: un boton que en el editor
      // era text rojo sobre blanco y en el player un rectangulo rojo. Anterior
      // al enganche del clic —basta `states`, y el hover ya los traia—.
      // Complex fills of Shapes (12 Sept). Painted on a child layer under the
      // SVG, masked with the shape, so the SVG keeps only the stroke. The mask
      // is on that layer and not on the slot: on the slot it would also cut the
      // outer half of the stroke.
      // Vector layers too, for pattern and generative (27 Sept): the layer is
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
      // Una mascara en mode ventana no lleva borde de caja: su contorno es
      // `maskStrokeWidth`, trazado sobre la silueta dentro del <svg>. Pintarlo
      // aqui dibujaba un rectangulo en el limite del slot y, al posicionarse
      // los elementos absolutos desde la caja de PADDING, empujaba el marco
      // anclado al lienzo por el ancho del borde: desbordaba por abajo y por la
      // derecha, y por ninguno de los otros dos lados.
      // NO en las capas de vector. Un icono no lleva un borde de caja
      // alrededor: el editor interpreta el trazo como el contorno de los
      // caminos del SVG, y aqui se dibujaba un rectangulo alrededor del icono
      // que el editor nunca enseño. Los iconos insertados antes del 21 de
      // agosto arrastran `strokeWidth: 2` de los valores por defecto de una
      // forma, asi que el borde salia sin que nadie lo pidiera.
      // `isSvg` tambien, no solo el tipo: los iconos insertados antes del 21
      // de agosto se creaban como `geo` con el SVG dentro del content, y esos
      // tambien tienen que quedar sin borde de caja.
      // Y tampoco en las formas que se dibujan con SVG: ahi el trazo va en el
      // `stroke` de la figura y sigue la silueta. Un `border` encima seria el
      // rectangulo que este trabajo vino a quitar.
      const hasVector = slotType === 'svg' || isSvg || !!style.svgRawXml
        || (isGeoLike && (!!shapeDrawing(style.geoShape) || !!style.svgPath));
      const resolvedStrokeColor = resolveCssColor(style.strokeColorRole, style.strokeColor);
      if (resolvedStrokeColor && style.strokeWidth && !isWindowMask && !hasVector) {
        const borderStyle = style.strokeStyle || 'solid';
        slotEl.style.setProperty('border', `${style.strokeWidth}px ${borderStyle} ${resolvedStrokeColor}`);
      }
      // Las formas no rectangulares se dibujan con SVG, como en el editor.
      //
      // Antes eran `clip-path` sobre el <div> mas un `border` de CSS, y de ahi
      // salian tres fallos a la vez: el borde dibujaba el RECTANGULO del
      // elemento en vez de la silueta -gemelo del fallo de la sombra-, los
      // puntos estaban copiados a mano y no coincidian con los del editor, y
      // las cinco formas que este motor no conocia -corazon, rombo, hexagono,
      // flecha y linea- caian a un `else` que solo pintaba el fondo y se
      // publicaban como rectangulos de color.
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
        // the box, the stroke ring and the fill drifted apart (13 Sept).
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

        // Un trazo abierto -la linea o dibujo libre- con fill se convierte en una barra.
        // A custom svgPath keeps its colour fill off (as before); only a photo may fill it.
        const fillable = drawing && (drawing.tipo === 'polygon' || drawing.rellenable);
        const resolvedSvgFill = resolveCssColor(style.fillColorRole, style.fillColor);
        const imageFill = (!drawing || !!fillable) && imageSrcSafe;
        figure.setAttribute(
          'fill',
          fillable && resolvedSvgFill && style.fillType !== 'none' && !hasComplexFill && !imageFill ? resolvedSvgFill : 'none'
        );
        // El garabato es la unica forma a la que el editor da respaldos de
        // trazo: sin grosor pinta 2, y sin color de trazo usa el de relleno.
        // Hay que replicarlos, porque al ser un trazo abierto no lleva relleno
        // -`rellenable: false`- y sin trazo no queda NADA que ver: el garabato
        // se veia en el editor y se publicaba invisible. La linea, en cambio,
        // usa `strokeWidth ?? 0` en el editor, asi que se deja como estaba.
        const isScribble = style.geoShape === 'scribble';
        const strokeThickness = style.strokeWidth && style.strokeWidth > 0
          ? style.strokeWidth
          : (isScribble ? 2 : 0);
        const strokeColor = (style.strokeColor || style.strokeColorRole)
          ? resolveCssColor(style.strokeColorRole, style.strokeColor || '#000000')
          : (isScribble ? (resolveCssColor(style.fillColorRole, style.fillColor) || '#2563EB') : '');
        if (strokeThickness && strokeColor) {
          figure.setAttribute('stroke', strokeColor);
          figure.setAttribute('stroke-width', String(strokeThickness));
          // Sin esto el trazo se estira con la capa: el `viewBox` va con
          // `preserveAspectRatio: none`, asi que una forma ancha y baja tendria
          // el borde grueso arriba y fino a los lados.
          figure.setAttribute('vector-effect', 'non-scaling-stroke');
          figure.setAttribute('stroke-linejoin', 'round');
          figure.setAttribute('stroke-linecap', 'round');
          if (style.strokeStyle === 'dashed') figure.setAttribute('stroke-dasharray', '6,4');
          else if (style.strokeStyle === 'dotted') figure.setAttribute('stroke-dasharray', '2,3');
        }
        svg.appendChild(figure);
        slotEl.appendChild(svg);
        if (imageFill) {
          const d = silhouette.d ?? 'M ' + silhouette.points!.split(' ').join(' L ') + ' Z';
          montarRellenoDeImagen(slotEl, style, { d, viewBox: silhouette.viewBox }, fillImageSrc);
        }

        // El color va en el <path>, no en el container, o se veria la caja
        // entera pintada por detras de la figura.
        slotEl.style.backgroundColor = 'transparent';
        slotEl.style.padding = '0';
        slotEl.style.overflow = 'visible';
      } else if (isGeoLike && !isWindowMask) {
        const geoShape = style.geoShape;
        if (geoShape === 'circle') {
          slotEl.style.borderRadius = '50%';
          // Y se borra del objeto de styles para que el bucle generico de mas
          // abajo no lo pise. `buildRawSlots` escribe SIEMPRE
          // `border_radius_px: 0` en el .oim, eso llega aqui como
          // `style.borderRadius = '0px'`, y ese bucle corre DESPUES: el circulo
          // acababa cuadrado.
          //
          // Llevaba asi desde siempre. No se veia porque los circulos de las
          // plantillas suelen ir bloqueados y horneados en la imagen base;
          // solo se rompe cuando el circulo es una capa viva.
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
        montarRellenoDeImagen(slotEl, style, {
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
        const fillCss: Record<string, string> = {
          ...getFillCss({
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
          }),
          ...(isVectorFill ? svgSilhouetteMaskCss(text) : shapeMaskCss(style.geoShape)),
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

      // Marco de la mascara dedicada. Gemelo de CanvasArea.tsx: un <path> con
      // fill-rule="evenodd" pinta el color y deja la silueta hueca, y un
      // segundo <path> opcional delinea el troquel.
      if (isWindowMask) {
        // El marco se ancla al lienzo y desborda la caja del slot a proposito,
        // asi que este slot no puede recortar ni centrar como uno de text.
        slotEl.style.overflow = 'visible';
        slotEl.style.display = 'block';
        slotEl.style.setProperty('padding', '0', 'important');
        slotEl.appendChild(buildWindowMaskSvg(slot, { width: baseWidth, height: baseHeight }));
      }

      // El padding de `.oim-slot` (`0 0.25em 0 0 !important`) existe para que la
      // ultima letra de un text en cursiva no se corte. En un slot que NO es
      // text solo ensancha la caja: con `box-sizing: content-box !important`
      // no se absorbe, asi que un slot de 800x1200 se media 806.7x1203.2 y todo
      // quedaba desplazado ~1.6px. Medido en el visor real.
      //
      // `paintsText` and not `!rawText`: for an image `rawText` is its source,
      // so images kept the padding, and a parallax image showed a strip at the
      // end of every lap (library, 4 Oct 2026).
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
        slotEl.style.left = leftPx + 'px';
        slotEl.style.top = topPx + 'px';
        
        const rotationDeg = style.rotation || 0;
        slotEl.style.setProperty('--oim-tx', transformX);
        slotEl.style.setProperty('--oim-ty', transformY);
        slotEl.style.setProperty('--oim-rot', rotationDeg + 'deg');

        // La caja ya resuelta en pixeles de lienzo. Se guarda porque el
        // wrapper del grupo, mas abajo, la necesita para su origen de
        // transformada y `pos`/`wRef`/`hRef` viven solo en este bloque.
        boxInCanvas = { x: pos[0] * baseWidth, y: pos[1] * baseHeight, width: wRef, height: hRef };
      }

      // Un GRUPO no se pinta: envuelve. Hasta la fase 3 llegaba aqui como un
      // slot cualquiera y salia como un elemento vacio con la caja del grupo,
      // encima de sus hijos — peso muerto en un archivo firmado.
      //
      // Aqui solo se CALCULA. Aplicarlo tiene que esperar a despues del bucle
      // que vuelca `style` sobre el elemento, porque ese bucle escribe
      // `style.width` y `style.height` —que el backend emite SIEMPRE, en cqw—
      // y pisaba el size del wrapper. Los hijos salian a la mitad de
      // size y fuera de sitio.
      //
      // No lo vio ninguna prueba: los slots que construyen no traen
      // `style.width`, asi que el bucle no tenia nada que pisar. Solo aparecio
      // al abrir un .oim firmado de verdad.
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
      if (style.textStrokeWidth) {
        const resolvedTextStroke = resolveCssColor(style.textStrokeColorRole || style.strokeColorRole, style.textStrokeColor || '#000000');
        slotEl.style.setProperty('-webkit-text-stroke', style.textStrokeWidth + 'px ' + resolvedTextStroke);
        slotEl.style.setProperty('paint-order', 'stroke fill');
      }
      // style.blendMode retired in 1.12.0: it never showed here (each slot is
      // isolated) nor in the editor; readers draw the layer as normal.
      // Unified effects stack (Spec 2026-10-07)
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
                const texInk = inkMargin(resolveLineHeight(style));
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
        // Fallback a campos legacy si style.effects no está presente
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

        const containerCss = getFillCss(containerShape);
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
        // `lineHeight` sale del volcado crudo y pasa por `resolveLineHeight`: el
        // valor del archivo llegaba aqui sin validar, asi que un `0` colapsaba
        // las lineas y un `99` tapaba el resto del documento.
        if (key === 'maxWidth' || key === 'maxWidths' || key === 'textAlign' ||
            key === 'fontSize' || key === 'fontSizes' ||
            key === 'rotation' || key === 'animation' || key === 'objectFit' ||
            key === 'lineHeight' || key === 'fontFamily') return;
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

      // Y aqui se APLICA, con `style` ya volcado, para que nada lo pise.
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
        // Y la scale del visor se NEUTRALIZA aqui.
        //
        // `--oim-scale` la fija el overlay y CASCADA a todo lo que hay dentro;
        // `.oim-slot` la aplica en su propia transformada. Para una capa
        // suelta eso es correcto, pero el wrapper es un `.oim-slot` que
        // CONTIENE a otros: sus hijos la recibian dos veces —la suya y la del
        // wrapper— y salian a la mitad de size dentro del grupo.
        //
        // No se ve en las pruebas de motor: happy-dom no compone
        // transformadas, asi que hay que mirar el ancho medido en un navegador
        // de verdad. Aparecio abriendo el .oim en el player del CDN.
        slotEl.style.setProperty('--oim-scale', '1');
        // Un slot normal recorta a su caja; el wrapper de un grupo normal cubre el
        // lienzo entero, asi que con `overflow: hidden` cualquier sombra o
        // desenfoque se cortaria. Pero si el grupo es de parallax (sceneLoop,
        // isParallaxGroup o hijos con parallax infinito), DEBE recortar con `hidden`
        // para que la pista infinita duplicada no se desborde fuera del marco.
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

        // Los hijos entran en `loopWrap`, no en `slotEl`. Lo marca para el
        // paso de anidado del final.
        //
        // `loopWrap` es donde corre la animacion del slot: las transformadas
        // se aplican ahi y NUNCA sobre `slotEl`, porque el transform de
        // `.oim-slot` es su anclaje de posicion. Si los hijos colgaran de
        // `slotEl` serian HERMANOS de la animacion en vez de estar dentro, y
        // animar un grupo moveria un wrapper vacio dejandolos quietos.
        loopWrap.dataset.oimGrupo = String(slot.id);
        // Y tiene que girar sobre el centro del GRUPO.
        // `.oim-slot-loop-wrap` trae `center center`, que en un wrapper del
        // size del lienzo es el centro del LIENZO: rotar desde ahi mandaria
        // el grupo a la otra punta.
        loopWrap.style.transformOrigin = wrapper.transformOrigin;
        // Y ocupar el wrapper entero: `.oim-slot-loop-wrap` es
        // `height: auto`, que sin content propio mide cero.
        loopWrap.style.height = '100%';
        loopWrap.style.overflow = 'visible';
      }

      if (style.animation && !self.disableAnimations) {
        const anim = style.animation;
        
        // Keyframes estructurados: el camino nuevo. Se ejecuta sobre loopWrap,
        // NUNCA sobre slotEl — el transform de .oim-slot es el anclaje de
        // posicionamiento (translate(var(--oim-tx,-50%), ...)) y animarlo
        // arrancaría la shape de su sitio.
        //
        // La opacidad de loopWrap se multiplica sola con la de slotEl (que
        // lleva el fade-in de entrada y la opacidad base de la shape) por
        // composición del DOM, así que no hay conflicto que secuenciar.
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
              // El easing real vive por keyframe; aquí debe quedar linear para
              // no aplicarse dos veces.
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
        // -`custom_loop_css`, `custom_keyframes`, `custom_hover_css`- into a
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

      // Los campos de interaccion viajan dentro de `slot.style`, que es donde los
      // pone `buildSlotStyle` en el editor. Se acepta tambien la raiz porque los
      // slots escritos a mano los llevan ahi.
      //
      // Leerlos SOLO en la raiz es el fallo con el que nacio esta feature: el
      // archivo estaba bien -isInteractive true, states.hover.actions con su
      // destino- y el player no enganchaba nada, porque la condicion nunca era
      // cierta. Ninguna prueba lo vio: todas construyen el slot con la forma que
      // el codigo espera. Lo enseño el primer .oim real que se abrio.
      // En mode imagen ni se lee: asi no se engancha nada Y no se avisa por
      // consola. Ese actionEvent existe para «el archivo lo pide y el player no sabe»;
      // aqui el player si sabe y ha decidido no hacerlo, asi que mandaria a
      // buscar un fallo que no existe —y en una galeria de veinte, veinte veces—.
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

        // Destinos que ya se avisaron, para no repetir el actionEvent en cada hover.
        // Vive aqui -por slot y por carga- y no en la instancia porque su vida
        // util es exactamente la de estos manejadores.
        const warnedTargets = new Set<string>();

        const actionRunner: ActionRunner = {
          run: function (actions, trigger) {
            const shadow = self.host.shadowRoot;
            if (!shadow) return;

            // El player DICE lo que va a hacer; no hace lo que le manden.
            //
            // El .oim no puede provocar nada por su cuenta: no declara handler,
            // ni URL, ni destino fuera de si mismo. Solo se anuncia, y solo
            // sirve de algo si la pagina se molesta en escuchar. Esa es la
            // frontera del consentimiento de quien embebe.
            //
            // Y es lo que hace INNECESARIO que el player navegue: si una pagina
            // quiere que pulsar lleve a un producto, escucha y navega ella, con
            // su URL y sus reglas.
            //
            // El detalle lleva SOLO identificadores que el autor puso en el
            // archivo. Nada de URLs ni de content: no es un canal hacia
            // fuera, es el documento hablando de si mismo.
            const actionEvent = new CustomEvent('oim:action', {
              cancelable: true,
              detail: {
                slot: slot.id,
                // El id lo inventa el editor al azar, asi que nadie puede
                // escribir `e.detail.slot === "Boton1"`. `name` es lo que el
                // autor teclea y ve en su lista de capas. El id se queda como
                // clave estable —los `targets` lo usan—; el nombre, como el
                // legible. Los nombres NO son unicos: quien escuche lo sabe.
                name: slot.name,
                trigger: trigger || 'unknown',
                targets: actions.map(function (a) { return a.target; }),
                types: actions.map(function (a) { return a.type; }),
              },
            });
            self.host.dispatchEvent(actionEvent);
            // `preventDefault()` veta el efecto local. Con esto una galeria
            // puede decidir clic a clic sin necesitar siquiera `mode="image"`.
            // Se sale ANTES de tocar `baseVisibility`, asi que el `revertir` de
            // un hover vetado tampoco encuentra nada que restaurar.
            if (actionEvent.defaultPrevented) return;

            // `play` runs a timeline; it has no visibility to record or revert.
            actions.forEach(function (act) {
              if (act.type === 'play' && act.target) self._playTimeline(String(act.target));
            });
            const currentVis: Record<string, boolean> = {};
            actions.forEach(function (act) {
              if (!act.target || act.type === 'play') return;
              const targetEl = shadow.querySelector('[data-slot-id="' + act.target + '"]') as HTMLElement | null;

              // Un destino que no existe es el fallo que aparece cuando se borra
              // una capa que era destino de un revelado: la accion se queda en el
              // archivo, ya firmado, y no hace nada. Se avisa una sola vez.
              if (!targetEl && !warnedTargets.has(act.target)) {
                warnedTargets.add(act.target);
                console.warn(
                  '[OimPlayer] El slot "' + slot.id + '" tiene una accion "' + act.type +
                    '" hacia "' + act.target + '", que no existe en este archivo. No hara nada.'
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
      // La geometria viaja tambien: getMaskClipPathD la necesita para situar
      // la silueta en coordenadas de lienzo. Antes solo se copiaban id, type y
      // style, asi que la mascara no sabia donde estaba.
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

    // `isMaskLayer` desaparecio al convertir la mascara en un tipo propio.
    // Comprobarlo aqui hacia que las definiciones no se generaran nunca y el
    // clipPath apuntara a un id inexistente: no recortaba nada.
    const hasMask = compositionSlots.some(function (s) { return s.type === 'mask'; });
    const hasDuotoneFilter = compositionSlots.some(function (s) { return s.type === 'filter' && !!(s.style && s.style.filterPreset === 'duotone'); });
    if (hasMask || hasDuotoneFilter) {
      fragment.appendChild(buildLayerCompositionDefs(compositionSlots, { width: baseWidth, height: baseHeight }));
    }

    compositionNodes.forEach(function (node) { attachCompositionNode(node, fragment, elByCompositionId); });

    // Los hijos entran DENTRO de su grupo. Se hace despues de componer y no
    // dentro de `computeLayerComposition` a proposito: la composicion decide
    // que recorta a que en la pila entera —mascaras y filtros— y meter ahi la
    // jerarquia mezclaria dos problemas que no tienen nada que ver.
    //
    // `appendChild` MUEVE el nodo, asi que cada hijo sale de su sitio en la
    // pila y entra en el grupo conservando el orden relativo entre hermanos.
    // El grupo ya ocupa la posicion que le toca, y sus hijos venian detras.
    //
    // Todo lo que falle aqui degrada a lo de siempre: un archivo sin
    // `style.groupId` no anida nada, un hijo cuyo grupo no llego se queda
    // suelto con sus coordenadas de lienzo, y un hijo dentro de una zona ni
    // siquiera esta en este mapa. Ninguna capa puede desaparecer.
    if (onlyIds) {
      // Sustitucion en su sitio: el nodo viejo cede el puesto al nuevo y el
      // resto del lienzo ni se entera. Conserva orden, animaciones y parallax.
      results.forEach(function (res: any) {
        if (!res) return;
        const slotIdText = res.slotEl.getAttribute('data-slot-id') || '';
        const previous = layer.querySelector('[data-slot-id="' + slotIdText + '"]');
        if (previous && previous.parentNode) {
          // Un grupo repintado tiene que llevarse a sus hijos al elemento
          // nuevo. Sin esto, `replaceChild` cambia el wrapper viejo -que
          // los CONTIENE- por uno vacio, y las capas de dentro desaparecen
          // del lienzo en cuanto se repinta el grupo, por ejemplo al cambiar
          // de idioma. Se mueven solo los nodos de slot: lo demas que cuelga
          // de un elemento -svg, envoltorios de lottie- es suyo y ya viene
          // rehecho.
          const inside = previous.querySelectorAll('[data-oim-grupo] > [data-slot-id], :scope > [data-slot-id]');
          for (let i = 0; i < inside.length; i++) {
            res.slotEl.appendChild(inside[i]);
          }
          previous.parentNode.replaceChild(res.slotEl, previous);
          // El controlador guarda el nodo, no el id: si no se reapunta, seguiria
          // moviendo el nodo viejo y la capa nueva se quedaria quieta.
          if (self._parallaxController) self._parallaxController.retarget(slotIdText, res.slotEl);
        }
      });
    } else {
      layer.innerHTML = '';
      layer.appendChild(fragment);
    }

    // Los hijos entran DENTRO de su grupo. Se hace sobre el arbol YA montado y
    // no sobre el fragmento, y despues de la sustitucion parcial y no antes,
    // por un caso que se escapa si se hace al reves: en un repintado parcial
    // que toca al grupo Y a un hijo, `replaceChild` mete el hijo nuevo dentro
    // del elemento VIEJO del grupo y acto seguido sustituye ese grupo entero.
    // El hijo se iba con el, y la capa desaparecia del lienzo.
    //
    // Anidar al final es ademas idempotente: `appendChild` sobre un nodo que
    // ya esta dentro solo lo reordena al final, y como se recorre en orden de
    // pila, el orden entre hermanos se conserva.
    //
    // Se hace tambien despues de componer y no dentro de
    // `computeLayerComposition` a proposito: la composicion decide que recorta
    // a que en la pila entera —mascaras y filtros— y meter ahi la jerarquia
    // mezclaria dos problemas que no tienen nada que ver.
    //
    // Todo lo que falle aqui degrada a lo de siempre: un archivo sin
    // `style.groupId` no anida nada y un hijo cuyo grupo no llego se queda
    // suelto con sus coordenadas de lienzo. Ninguna capa puede desaparecer.
    if (groupChildren.size > 0) {
      const inZone = function (el: Element): boolean {
        for (const zoneId in zonesMap) {
          if (zonesMap[zoneId] && zonesMap[zoneId].contains(el)) return true;
        }
        return false;
      };
      groupChildren.forEach(function (childIds: string[], groupId: string) {
        const groupSlot = layer.querySelector('[data-slot-id="' + groupId + '"]');
        // Una zona es un container con su propio flujo: sacar de ahi una capa
        // para meterla en un grupo la reposicionaria sin que nadie lo pida.
        if (!groupSlot || inZone(groupSlot)) return;
        // Dentro del container que ANIMA, no del slot: ver el comentario de
        // `data-oim-grupo` mas arriba.
        const groupEl = groupSlot.querySelector('[data-oim-grupo="' + groupId + '"]') || groupSlot;
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
          // Sin esto se acumulaban: cada render completo creaba un
          // controlador con su listener de mousemove y su bucle de rAF, y el
          // anterior seguia corriendo para siempre.
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

                // Sobredimensionado: una capa pegada al borde descubre el vacio
                // al desplazarse. Se agranda lo justo para que no se vea, y solo
                // si llega al borde -si no, separarse un poco es el efecto-.
                //
                // La caja se recalcula en vez de medir el nodo: `offsetWidth`
                // aqui es 0 mientras el lienzo no se ha maquetado.
                const isBackground = s.is_background_pattern === true || s.id === 'background-pattern-slot';
                const pos = normalizePosition(s.position || [0.5, 0.5]);
                const layerWidth = isBackground ? baseWidth
                  : (s.width_px || (s.widthPercent ? (s.widthPercent / 100) * baseWidth : 0));
                const layerHeight = isBackground ? baseHeight
                  : (s.height_px || (s.heightPercent ? (s.heightPercent / 100) * baseHeight : 0));
                // Las tres alineaciones se cancelan con su propio `--oim-tx`:
                // el borde izquierdo acaba en `pos[0] * ancho` en las tres.
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
                  // Se mira el NODO y no se reconstruye la condicion. El player
                  // monta la pista si la velocidad no es cero -sin mirar el
                  // mode- y el editor si el mode es infinito o `inf.enabled`:
                  // son dos condiciones distintas y volver a escribir
                  // cualquiera de ellas aqui seria una tercera.
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

  // Pipeline de actualizaciones agrupadas para evitar reflujos (style Lottie)
  private _pendingDOMUpdates = new Map<HTMLElement, Record<string, string | undefined>>();
  private _isUpdateScheduled = false;
  private _updateCallbacks: (() => void)[] = [];

  public queueUpdate(el: HTMLElement, styles: Partial<CSSStyleDeclaration> | Record<string, string | undefined>, callback?: () => void) {
    // Solo las CADENAS, y no es una formalidad de tipos.
    //
    // `Partial<CSSStyleDeclaration>` trae ademas `length` -un numero- y una
    // decena de metodos como `setProperty`. `_flushDOMUpdates` recorre este
    // mapa con `Object.entries` y asigna cada clave a `el.style[k]`, asi que
    // un `length` colado acabaria en `el.style.length = 5` y un metodo en
    // `el.style.setProperty = fn`: ninguno de los dos hace nada, ninguno
    // protesta, y el style que si venia detras se aplica igual. Un fallo que
    // solo se ve si lo buscas.
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

    // Ejecutar callbacks de forma segura en el siguiente microtask
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
    const nodos = nodosA11y(slots, this.lang, principal, !this.disableActions);
    if (this._overlay) this._overlay.setAttribute('aria-hidden', 'true');
    viewport.setAttribute('role', 'figure');
    viewport.setAttribute('aria-label', etiquetaDeLaObra(meta, nodos, this.lang, principal));
    let box = viewport.querySelector('.oim-a11y') as HTMLElement | null;
    if (!box) {
      box = document.createElement('div');
      box.className = 'oim-a11y';
      box.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
      viewport.appendChild(box);
    }
    box.textContent = '';
    const self = this;
    nodos.forEach(function (n) {
      let el: HTMLElement;
      if (n.tipo === 'texto') {
        el = document.createElement('p');
        el.setAttribute('lang', n.lang);
        el.textContent = n.texto;
      } else if (n.tipo === 'imagen') {
        el = document.createElement('span');
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', n.etiqueta);
      } else {
        el = document.createElement('button');
        el.setAttribute('type', 'button');
        el.textContent = n.etiqueta;
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

  private _activeTouchSlot: { el: HTMLElement; leave: () => void } | null = null;

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

  _bindViewportEvents(): void {
    const self = this;
    const stage = this._stage;
    if (!stage) return;

    // Tocar fuera en pantallas táctiles desactiva el slot actualmente activo (un único escuchador)
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      if (!self._activeTouchSlot) return;
      // `e.target` NO sirve aqui: este escuchador vive en el host, fuera del
      // shadow root, y al cruzar esa frontera el navegador reescribe el target
      // al propio host para no filtrar los internos. La comprobacion veia el
      // host, concluia "fue fuera" y salia del estado justo despues de que el
      // slot acabara de entrar: el toque se encendia y se apagaba en el mismo
      // gesto. `composedPath()` si atraviesa la frontera.
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const hitSlot = path.indexOf(self._activeTouchSlot.el) !== -1;
      if (!hitSlot) {
        const active = self._activeTouchSlot;
        self._activeTouchSlot = null;
        active.leave();
      }
    });

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    stage.addEventListener('mousedown', function (e) {
      if (!self.allowZoom) return; 
      if (self.zoom <= 1.0) return;
      if ((e.target as HTMLElement).closest('.oim-slot')) {
        return;
      }
      isDragging = true;
      if (self._viewport) {
        self._viewport.style.transition = 'none';
      }
      stage.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      startPanX = self.panX;
      startPanY = self.panY;
      e.preventDefault();
    });

    // Guardados en la instancia y no anonimos: `removeEventListener` necesita
    // la MISMA referencia, asi que un listener anonimo en `window` no se puede
    // quitar nunca. Con un player por tarjeta en un feed, eso es un listener
    // por tarjeta acumulandose para siempre.
    this._onDragMove = function (e: MouseEvent) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      self.panX = startPanX + dx;
      self.panY = startPanY + dy;
      self._constrainPan();
      self._applyViewportTransform();
    };
    window.addEventListener('mousemove', this._onDragMove);

    this._onDragEnd = function () {
      if (isDragging) {
        isDragging = false;
        if (self._viewport) {
          self._viewport.style.transition = 'transform 0.1s linear';
        }
        stage.style.cursor = self.zoom > 1.0 ? 'grab' : 'default';
      }
    };
    window.addEventListener('mouseup', this._onDragEnd);

    let initialTouchDistance: number | null = null;
    let initialZoom = 1;
    let isTouchPanning = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartPanX = 0;
    let touchStartPanY = 0;

    stage.addEventListener('touchstart', function (e) {
      if (!self.allowZoom) return; 

      if (e.touches.length === 2) {
        initialTouchDistance = getTouchDistance(e.touches);
        initialZoom = self.zoom;
        isTouchPanning = false;
        if (self._viewport) self._viewport.style.transition = 'none';
      } else if (e.touches.length === 1 && self.zoom > 1.0) {
        if ((e.target as HTMLElement).closest('.oim-slot')) {
          return;
        }
        isTouchPanning = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartPanX = self.panX;
        touchStartPanY = self.panY;
        if (self._viewport) self._viewport.style.transition = 'none';
      }
    }, { passive: true });

    stage.addEventListener('touchmove', function (e) {
      if (!self.allowZoom) return; 
      if (e.touches.length === 2 && initialTouchDistance !== null) {
        const currentDistance = getTouchDistance(e.touches);
        if (initialTouchDistance > 0) {
          const factor = currentDistance / initialTouchDistance;
          self.setZoom(initialZoom * factor);
        }
      } else if (e.touches.length === 1 && isTouchPanning) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        self.panX = touchStartPanX + dx;
        self.panY = touchStartPanY + dy;
        self._constrainPan();
        self._applyViewportTransform();
      }
    }, { passive: true });

    stage.addEventListener('touchend', function () {
      initialTouchDistance = null;
      isTouchPanning = false;
      if (self._viewport) self._viewport.style.transition = 'transform 0.1s linear';
    }, { passive: true });

    if (self.allowZoom) {
      stage.addEventListener('wheel', function (e) {
        e.preventDefault();
        self.setZoom(nextWheelZoom(self.zoom, e.deltaY, e.deltaMode, e.ctrlKey));
      }, { passive: false });
    }
  }

  _constrainPan(): void {
    const host = this.host;
    if (!host) return;

    const W = host.clientWidth;
    const H = host.clientHeight;
    const Z = this.zoom;

    const maxPanX = Math.max(0, (W * (Z - 1)) / 2);
    const maxPanY = Math.max(0, (H * (Z - 1)) / 2);

    this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
    this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
  }

  _applyViewportTransform(): void {
    if (this._viewport) {
      this._viewport.style.transform = 'translate3d(' + this.panX + 'px, ' + this.panY + 'px, 0) scale(' + this.zoom + ')';
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

    // Sin cambios no hay transicion: difuminar para mostrar la misma imagen es
    // un parpadeo que sugiere que paso algo cuando no paso nada.
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
   * El cambio ocurre en el PICO del desenfoque, no durante la rampa.
   *
   * Aplicarlo durante la rampa es lo que se veia como un estirado de las capas:
   * estabas viendo COMO se modificaba, medio borroso. En el pico no se distingue
   * nada, y al volver el foco ya es otra imagen.
   */
  _switchWithBlur(changes: { styleOnly: Set<string>; content: Set<string> }): void {
    const viewport = this._viewport;
    const self = this;
    if (!viewport) { this._applyLangChange(changes); return; }

    viewport.style.transition = 'filter 0.18s ease-out';
    viewport.style.filter = 'blur(14px)';

    setTimeout(function () {
      const ready = self._applyLangChange(changes);
      // No se vuelve a enfocar hasta que las imagenes reconstruidas esten
      // cargadas: si no, el desenfoque se va y la imagen aparece despues.
      const cap = new Promise(function (r) { setTimeout(r, 600); });
      Promise.race([ready || Promise.resolve(), cap]).then(function () {
        viewport.style.transition = 'filter 0.32s ease-in-out';
        viewport.style.filter = 'none';
      });
    }, 180);
  }

  /**
   * Alternativa para quien pidio menos movimiento.
   *
   * Un fundido de opacidad NO desplaza nada, asi que cumple la peticion; y evita
   * el salto seco justo en la zona donde esta mirando el ojo, que es lo que
   * dejaria quitar la transicion del todo. Solo sobre las capas que cambian.
   */
  _switchWithFade(changes: { styleOnly: Set<string>; content: Set<string> }): void {
    const shadow = this.host.shadowRoot;
    const self = this;
    const ids = new Set([...changes.styleOnly, ...changes.content]);
    const affected: HTMLElement[] = [];

    if (shadow) {
      ids.forEach(function (id) {
        const el = shadow.querySelector('[data-slot-id="' + id + '"]') as HTMLElement | null;
        // Una capa con animacion propia de opacidad cambia sin fundido: pelearian
        // entre si y se veria un parpadeo que nadie sabria explicar.
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
        // A su opacidad real, no a 1: una capa al 40% se quedaria opaca del todo.
        // El motor ya guarda ese valor en dataset.oimOpacity por este mismo motivo.
        if (el) el.style.opacity = el.dataset.oimOpacity !== undefined ? el.dataset.oimOpacity : '1';
      });
    }, 120);
  }

  /** Reparte las capas segun lo que el idioma les cambia. */
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

        // Valores EFECTIVOS: localizedEntries ya aplico la precedencia del fondo.
        const e = localizedEntries(slot, self.lang);
        el.style.fontSize = e.size;
        el.style.maxWidth = e.maxWidthValue;
      });
    }
    if (changes.content.size > 0) {
      return this.renderSlots({ onlyIds: changes.content });
    }
    return null;
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    
    if (this.zoom <= 1.0) {
      this.panX = 0;
      this.panY = 0;
    }
    
    this._constrainPan();
    this._applyViewportTransform();
    // NOTE: Do NOT call updateScale() here.
    // --oim-fit reflects (viewportWidth / designWidth) and only needs updating
    // when the container/viewport dimensions change (handled by ResizeObserver).
    // The user-zoom factor is already applied via the viewport's CSS transform;
    // calling getBoundingClientRect() on every wheel tick causes layout thrash.

    const stage = this._stage;
    if (stage) {
      stage.style.cursor = this.zoom > 1.0 ? 'grab' : 'default';
    }
  }

  play(): void {
    this._paused = false;
    // A still player keeps frozen what it built frozen (`_isStill`, the same
    // rule as the infinite loop and the parallax). A card that scrolls into
    // view is "active" and gets play(): it woke the Lottie that
    // `disable-animations` froze on frame 0, and the mobile library spent its
    // scroll animating cards meant to be still (measured 9 Oct 2026).
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

  /** Destruye solo los Lottie de las capas indicadas, y los saca de la lista. */
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
  }
}
export default ImageEngine;

/**
 * Traduce los keyframes del .oim a los que espera WAAPI.
 *
 * El transform se compone en el mismo orden que el editor
 * (CanvasArea.tsx:267): translate() rotate() scale(). Cambiar el orden
 * cambia el resultado — no es conmutativo.
 *
 * Los offsets van en px de espacio de diseño: el overlay del player YA es
 * espacio de diseño y scale como una unidad, así que escalan solos.
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

