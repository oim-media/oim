import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { REFERENCE_OIM } from '../../core/test/fixtures/index.ts';

// Configure happy-dom environment for the test file
/**
 * @vitest-environment happy-dom
 */

// Read the actual example_image.oim file to return in mock fetch requests
const oimFilePath = REFERENCE_OIM;
const oimBuffer = fs.readFileSync(oimFilePath);

// Ignore Node.js DecompressionStream unhandled rejection warnings for raw deflate fallback
process.on('unhandledRejection', (reason) => {
  if (reason && (reason.code === 'Z_DATA_ERROR' || (reason.cause && reason.cause.code === 'Z_DATA_ERROR'))) {
    return;
  }
});

// Mock window.fetch globally to return the real binary data of example_image.oim
global.fetch = vi.fn().mockImplementation((url, init) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: {
      get: (header) => {
        if (header.toLowerCase() === 'content-length') {
          return oimBuffer.length.toString();
        }
        return null;
      }
    },
    arrayBuffer: () => Promise.resolve(oimBuffer.buffer.slice(oimBuffer.byteOffset, oimBuffer.byteOffset + oimBuffer.byteLength)),
    blob: () => Promise.resolve(new Blob([oimBuffer], { type: 'image/png' }))
  });
});

describe('oim-player Web Component', () => {
  beforeEach(async () => {
    // An IntersectionObserver that reports on observe, as a real browser does
    // for an element that is visible.
    //
    // It is needed since loading became lazy: happy-dom's version exists but
    // NEVER fires, so without this the player stays dormant and these five
    // tests would measure an empty element. This is not a workaround to make
    // them pass: it is the condition "this player is visible", which used to
    // hold by accident because the `src` loaded by force.
    window.IntersectionObserver = class {
      constructor(cb) { this._cb = cb; }
      observe(el) {
        this._cb([{
          target: el,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: { bottom: 100, top: 0, left: 0, right: 100 },
        }], this);
      }
      unobserve() {}
      disconnect() {}
    };
    // Dynamically load the component script (runs the IIFE and registers oim-player)
    await import('../dist/oim-player.js');
  });

  it('should define the oim-player custom element', () => {
    expect(customElements.get('oim-player')).toBeDefined();
  });

  it('should attach an open shadow root when connected to the DOM', async () => {
    const player = document.createElement('oim-player');
    document.body.appendChild(player);

    player.setAttribute('src', 'example.oim');
    
    // Wait a brief moment for the async load() method inside oim-player to run
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(player.shadowRoot).not.toBeNull();
    expect(player.shadowRoot.mode).toBe('open');

    document.body.removeChild(player);
  });

  it('should contain the custom :host rules styling host as flex box', async () => {
    const player = document.createElement('oim-player');
    document.body.appendChild(player);

    player.setAttribute('src', 'example.oim');
    
    // Wait for the async load() to fetch the mock data and inject elements/styles
    await new Promise(resolve => setTimeout(resolve, 100));

    const styleEl = player.shadowRoot.getElementById('oim-player-styles');
    expect(styleEl).not.toBeNull();

    const cssText = styleEl.textContent;
    
    expect(cssText).toContain(':host {');
    expect(cssText).toContain('display: flex !important');
    expect(cssText).toContain('overflow: hidden');

    document.body.removeChild(player);
  });

  it('should style slots with user-select: none to prevent selectability', async () => {
    const player = document.createElement('oim-player');
    document.body.appendChild(player);

    player.setAttribute('src', 'example.oim');
    
    // Wait for load and rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    const styleEl = player.shadowRoot.getElementById('oim-player-styles');
    const cssText = styleEl.textContent;

    expect(cssText).toContain('.oim-slot {');
    expect(cssText).toContain('user-select: none');
    expect(cssText).toContain('-webkit-user-select: none');

    expect(cssText).toContain('.oim-slot:hover {');
    // Hover MULTIPLIES by `--oim-scale`: if it replaced it, moving the pointer
    // over an oversized layer would snap it back to its size and expose the
    // parallax clipping.
    expect(cssText).toContain('scale(calc(var(--oim-scale, 1) * var(--oim-slot-hover-scale, 1)))');

    document.body.removeChild(player);
  });

  it('should auto-rotate languages when auto-rotate-lang attribute is set', async () => {
    const player = document.createElement('oim-player');
    player.setAttribute('auto-rotate-lang', '50'); // 50ms interval for testing
    document.body.appendChild(player);

    player.setAttribute('src', 'example.oim');
    player.setAttribute('lang', 'es');
    
    // The language should change from 'es' to the next available one. Polled,
    // not a fixed 150 ms sleep: on a loaded CI runner loading took longer
    // and the test failed intermittently.
    await vi.waitFor(() => expect(player.getAttribute('lang')).not.toBe('es'), { timeout: 3000, interval: 25 });

    document.body.removeChild(player);
  });

  it('should support programmatic properties languages, currentLang, and lang', async () => {
    const player = document.createElement('oim-player');
    document.body.appendChild(player);

    player.setAttribute('src', 'example.oim');
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(player.languages).toContain('es');
    expect(player.languages).toContain('en');
    expect(player.currentLang).toBe('es');

    player.lang = 'en';
    expect(player.getAttribute('lang')).toBe('en');

    document.body.removeChild(player);
  });

  it('should restrict lottie rendering if allow-lottie attribute is false', async () => {
    const player = document.createElement('oim-player');
    player.setAttribute('allow-lottie', 'false');
    document.body.appendChild(player);

    player.setAttribute('src', 'example.oim');
    await new Promise(resolve => setTimeout(resolve, 100));

    const engine = player.getEngine();
    expect(engine.allowLottie).toBe(false);

    document.body.removeChild(player);
  });
});

