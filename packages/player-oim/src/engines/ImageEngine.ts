/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OIMRegistry } from '../render/registry.js';
import { setFlag } from '../../../scene/src/legacy/attrs.js';
import { playerString } from '../../../scene/src/legacy/strings.js';
import { getDeviceProfile, type DeviceProfile } from '../../../scene/src/legacy/device-tier.js';
import { fileCache, type VerifyResult, type VerifiedFile } from '../render/file-cache.js';
import { injectStyles } from '../../../scene/src/legacy/styles.js';
import { renderMarkedText, plainOf, type Marks } from '../../../scene/src/legacy/marked-text.js';
import { dropCapStyle, splitDropCap } from '../../../core/src/drop-cap.js';
import { layerTextureMask } from '../../../core/src/effects/texture-mask.js';
import { isEntranceEffect, entranceUnits, entranceStart, entranceKeyframes, entranceClips, ENTRANCE_SECONDS, type EntranceEffect } from '../../../core/src/text-effects.js';
import { loadLottie } from '../../../scene/src/legacy/lottie-loader.js';
import { normalizeRawSlots } from '../render/normalize-raw-slots.js';
import { sanitizeHtml, sanitizeFontFamily } from '../render/security.js';
import { verifyInWorker, type WorkerReply } from '../render/verify-worker.js';
import { extractOIM } from '../../../core/src/binary.js';
import { validateOimMetadata, verifyMetadataSignature, securityVerdict, isRefused, ALTERED_FILE_ERROR, isSandboxImageSrc, keyExpiredForFile } from '../render/security.js';
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
} from '../../../scene/src/legacy/layerComposition.js';
import {
  buildWaveKeyframesCss,
  waveCharAnimationDelay,
  WAVE_PERIOD_SECONDS,
  WAVE_KEYFRAMES_NAME,
} from '../../../scene/src/legacy/waveText.js';
import { calculateGlitchState, glitchLayers } from '../../../core/src/glitch.js';
import { easingToCss, revealFrames, revealTiming } from '../../../core/src/reveal.js';
import { calculateTypewriterState } from '../../../scene/src/legacy/typewriterText.js';
import { getFillCss, patternLayerCss, shapeMaskCss, svgSilhouetteMaskCss } from '../../../core/src/fill.js';
import { paintPattern } from '../../../scene/src/legacy/patternPaint.js';
import { resolveCssColor, resolvePalette, DYNAMIC_COLOR_ROLES } from '../../../core/src/dynamic-colors.js';
import { nextWheelZoom, MIN_ZOOM, MAX_ZOOM } from '../render/wheelZoom.js';
import { applyTrimToSvgPaths, ensureTrimKeyframes } from '../../../scene/src/legacy/trimPath.js';
import { shapeDrawing } from '../../../core/src/geoShapes.js';
import { frameSilhouette } from '../../../core/src/frame-silhouette.js';
import { mediaFilterCss } from '../../../core/src/media-filters.js';
import { buildSvgNoiseFilter, buildLayerGrainFilter, GRAIN_LAYER_TYPES } from '../../../core/src/generative/proceduralNoise.js';
import { TEXTURE_CATALOG, type TexturePreset } from '../../../core/src/effects/index.js';
import { infiniteLayerPlan, TRACK_CLASS, LEGACY_TRACK_CLASS, ensureParallaxKeyframes, type InfiniteLayer } from '../../../core/src/parallaxCss.js';
import { localizedEntries, isImageContent, compareLangs } from '../../../scene/src/legacy/localizedEntries.js';
import { a11yNodes, artworkLabel } from '../../../scene/src/legacy/a11y.js';
import { dropShadowCss, shadowColorCss, shadowFollowsGlyphs } from '../../../scene/src/legacy/shadow.js';
import { cropCss } from '../../../core/src/crop.js';
import { mountImageFill } from '../../../scene/src/legacy/image-fill.js';
import { flipScale } from '../../../core/src/flip.js';
import { isGroup, childrenByGroup, wrapperStyle } from '../../../scene/src/legacy/groups.js';
import { resolveLineHeight, inkMargin } from '../../../core/src/typography.js';
import { resolveDimensionToCss, resolveNumericDimension } from '../../../core/src/dimensions.js';
import { slotClipping } from '../../../core/src/clipping.js';
import { whatTheReaderCannotDo, describeMissing, CONTRACT_VERSION, PLAYER_CAPABILITIES } from '../../../core/src/compatibility.js';
import { bindStates, resolveActions, applyMinHitArea, readInteraction, type ActionRunner, type RegisterOutsideTap } from '../../../scene/src/legacy/states.js';
import { resolveMode } from '../../../scene/src/legacy/modes.js';
import { buildArtisticTextModelFromSlot, generateArtisticTextSvgString } from '../../../scene/src/legacy/artisticText.js';
import { readEmbeddedFonts, registerEmbeddedFonts, embeddedFontFamily } from '../../../scene/src/legacy/embeddedFonts.js';
import { LegacyRenderer, getTouchDistance, type ImageEngineOptions } from '../../../scene/src/legacy/renderer.js';
export * from '../../../scene/src/legacy/renderer.js';

export class ImageEngine extends LegacyRenderer {
  constructor(host: HTMLElement, opts?: ImageEngineOptions) {
    super();
    const options = opts || {};
    this.host = host;
    this.lang = host.getAttribute('lang') || 'en';
    this.showControls = host.getAttribute('show-controls') !== 'false';
    this._deviceProfile = getDeviceProfile();
    
    this.allowZoom = options.allowZoom === true;
    this.showLanguageSelector = options.showLanguageSelector !== false;
    this.showSlots = options.showSlots !== false;
    this.allowLottie = options.allowLottie !== false && host.getAttribute('allow-lottie') !== 'false';
    // Dynamic colors. ON by default, like `allow-lottie`: if a site has bothered to define
    // `--oim-color-*`, it wants them. This attribute exists to exempt specific images --
    // a public work by another author
    // need not adopt your palette.
    //
    // No need to turn it off for the common case: the function is already opt-in at page
    // level, because `var(--oim-color-x, fallback)` falls back to the author's fallback if the
    // site does not define the variable.
    this.allowDynamicColors =
      options.allowDynamicColors !== false && host.getAttribute('allow-dynamic-colors') !== 'false';
    
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The two flags come from `core/modos.ts`, which is the ONLY place where they are decided.
    // Having it here too would mean the player is configured one way when mounted and another
    // way when one of its attributes is changed on the fly.
    const mode = resolveMode(host as any, options, prefersReducedMotion);
    this.disableAnimations = mode.disableAnimations;
    this.disableActions = mode.disableActions;
    this.dropdownBlur = options.dropdownBlur !== false && host.getAttribute('dropdown-blur') !== 'false';
    this.fit = options.fit || 'contain';
    this.align = options.align || 'center';
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
      try { a.cancel(); } catch (e) { /* the animation already died with its node */ }
    });
    this._animations = [];
    this._timelines.clear();
    this._revealAnims.clear();
    this._heldTimelines.clear();
    this._textAnimations.forEach(function (a) {
      try { a.stop(); } catch (e) {}
    });
    this._textAnimations = [];
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

      // Dynamic colors OFF for THIS image: all eight roles are neutralized in the
      // viewer. Setting a custom property to `initial` makes `var(--x, fallback)` fall
      // back to the fallback -- verified in the browser.
      //
      // It is turned off here, in the viewer, and not by filtering each colour call,
      // so it does not matter how many places paint colour today or tomorrow.
      if (!this.allowDynamicColors && this._viewport) {
        for (const role of DYNAMIC_COLOR_ROLES) {
          (this._viewport as HTMLElement).style.setProperty('--oim-color-' + role, 'initial');
        }
      }
      this.applyPalette();

      // If the user has 'prefers-reduced-motion: reduce' enabled, the 14px blur is not
      // applied; it stays at 'none' (transitioning only opacity).
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
          if (box) box.textContent = playerString('tampered', self.lang);
        }
        host.dispatchEvent(new CustomEvent('error', { detail: err }));
        throw err;
      });
    } catch (err: any) {
      console.error('[OimPlayer::ImageEngine]', err);
      shadow.innerHTML = '<div class="oim-player-error" part="error"></div>';
      const errorDiv = shadow.querySelector('.oim-player-error') as HTMLElement;
      if (errorDiv) {
        errorDiv.textContent = playerString('loadError', this.lang) + err.message;
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
      // The format degrades gracefully: unknown keys survive `passthrough`,
      // so a newer file does not crash an older player, but it previously
      // degraded IN SILENCE. The schema declares capabilities that this
      // player does not implement; a file using them would render poorly without
      // its author being able to tell this apart from their own mistake.
      //
      // Only for ACCEPTED files: if the signature is invalid or the file is
      // revoked, nothing is rendered, and discussing capabilities there would
      // distract from the real issue.
      announce = true;
      // Normalize the Python backend format AFTER signature validation (mutating it before would break the signature check).
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
    // The palette is first applied before the file is read; only now are its palettes known.
    this.applyPalette();

    // A PUBLIC file carries its own stamp. Showing it with the same green
    // badge as an authored file ("Signature verified") would promise too much:
    // anyone can take a public file, alter a number, re-sign it, and it would
    // appear just as verified. The signature still guarantees the same thing
    // — that nobody touched it after signing; what it does not guarantee is
    // that it is the original file.
    this.securityStatus = v.security;
    if (this.securityStatus === 'unsigned') {
      try { setFlag(this.host, 'data-oim-unsigned', 'data-oim-sin-firma'); } catch (e) {}
      console.warn('[OimPlayer] Unsigned file: painting the base image only. Interactive layers need a signature.');
    }
    if (this.securityStatus === 'expired_key') {
      try { setFlag(this.host, 'data-oim-key-retired', 'data-oim-clave-retirada'); } catch (e) {}
      console.warn('[OimPlayer] This work was signed with a retired key. Ask the author to export it again.');
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
   * Counts what this player cannot honour in the file.
   *
   * It does NOT throw nor stop painting: the format degrades to PNG by design, and a
   * `.oim` that is not fully understood is still a valid image. That safety net is
   * something Rive and Lottie do not have, and rejecting would turn a partial loss
   * into a total one.
   *
   * It is counted in three places because there are three different audiences: the console
   * for whoever debugs, an attribute on the host for whoever inspects the DOM, and an
   * event for whoever embeds the player and wants to react.
   *
   * And it stays silent when there is nothing to say. An actionEvent that fires with normal
   * files (those without `min_player`, that is, all those published to date) becomes
   * background noise, and then nobody reads it
   * on the day it says something.
   */
  _announceUnsupported(metadata: any): void {
    let missing;
    try {
      missing = whatTheReaderCannotDo(metadata, {
        version: CONTRACT_VERSION,
        capabilities: PLAYER_CAPABILITIES,
      });
    } catch (e) {
      return; // Warning about an incompatibility must never be what breaks anything.
    }
    if (!missing.hasNotice) return;

    const message = describeMissing(missing);
    try { console.warn('[OimPlayer] ' + message); } catch (e) { /* consola ajena */ }

    try {
      if (missing.missingCapabilities && missing.missingCapabilities.length > 0) {
        setFlag(this.host, 'data-oim-unsupported', 'data-oim-sin-soporte', missing.missingCapabilities.join(' '));
      }
      if (missing.missingRequiredCapabilities && missing.missingRequiredCapabilities.length > 0) {
        setFlag(this.host, 'data-oim-missing-required', 'data-oim-requeridas-faltantes', missing.missingRequiredCapabilities.join(' '));
      }
      if (missing.versionTooOld && missing.requiredVersion) {
        setFlag(this.host, 'data-oim-required-version', 'data-oim-version-exigida', missing.requiredVersion);
      }
      // `mensaje` is the Spanish name, kept for existing embedders. Deprecated: removed in 2.0.0
      // (same policy as the legacy data-oim-* attributes). Use `message`.
      this.host.dispatchEvent(new CustomEvent('oim:incomplete', {
        bubbles: true, composed: true,
        detail: { message, mensaje: message, ...missing },
      }));
      if (missing.cannotRender) {
        this.host.dispatchEvent(new CustomEvent('oim:unsupported', {
          bubbles: true, composed: true,
          detail: { message, mensaje: message, ...missing },
        }));
      }
    } catch (e) { /* a host that does not accept attributes must not break loading */ }
  }

  updateScale(): void {
    if (!this._viewport) return;
    // Layout width: no transform in it (neither the player's zoom nor a
    // parent's), so nothing to divide back out.
    const untransformedWidth = this._viewport.offsetWidth;
    const canvasWidth = this.metadata && this.metadata.canvas ? (this.metadata.canvas.natural_width || this.metadata.canvas.width) : 0;
    const designWidth = (this.metadata && (this.metadata.artboardWidth || this.metadata.canvasWidth || this.metadata.canvas_width)) || canvasWidth || (this._baseImg && this._baseImg.naturalWidth) || 1080;
    const scale = untransformedWidth / designWidth;
    // `--oim-fit`, not `--oim-scale`.
    //
    // These are two different concepts that shared a name: here it is the FIT factor of the
    // document to the host's box, and at ~line 2272 it is the shape's OWN scale. Since this one
    // is set on the viewer, it travelled by inheritance down to each `.oim-slot`, whose rule
    // does `scale(var(--oim-scale, 1))` expecting a 1 (and `var(--x, 1)` only falls back to 1
    // if the variable does NOT EXIST anywhere in the chain, not if nobody gave it to that box).
    // Result: the fit was applied twice, once on the overlay
    // and again on each slot, and everything came out 20% smaller.
    // Measured on a real .oim, a 140px shape was painted at 90
    // instead of 112.
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

  _bindViewportEvents(): void {
    const self = this;
    const stage = this._stage;
    if (!stage) return;

    // A touch outside the slot on touch screens deactivates the currently active slot (a single listener)
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      if (!self._activeTouchSlot) return;
      // `e.target` does NOT work here: this listener lives on the host, outside the
      // shadow root, and when it crosses that boundary the browser rewrites the target
      // to the host itself so as not to leak the internals. The check saw the
      // host, concluded "it was outside", and left the state just after the slot had
      // just entered: the touch switched on and off in the same gesture.
      // `composedPath()` does cross the boundary.
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

    // Stored on the instance and not anonymous: `removeEventListener` needs
    // the SAME reference, so an anonymous listener on `window` can never be
    // removed. With one player per card in a feed, that is one listener
    // per card piling up forever.
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
}
export default ImageEngine;
