/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ImageEngine from './ImageEngine';

describe('Adaptive performance (device tiering)', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it('on a mobile or low-tier device, the language change uses a blur-free fade in the viewport', () => {
    const motor = new ImageEngine(host as any);
    // Simulate a mobile profile
    motor._deviceProfile = {
      tier: 'low',
      isMobile: true,
      prefersReducedMotion: false,
      cores: 4,
      saveData: false,
    };

    const shadow = host.attachShadow({ mode: 'open' });
    const viewport = document.createElement('div');
    viewport.className = 'oim-player-viewport';
    const slot = document.createElement('div');
    slot.setAttribute('data-slot-id', 'titulo');
    slot.style.opacity = '1';
    viewport.appendChild(slot);
    shadow.appendChild(viewport);
    motor._viewport = viewport;

    // Simulate a content change in 'titulo'
    motor._classifyLangChange = () => ({
      styleOnly: new Set<string>(),
      content: new Set(['titulo']),
    });
    motor._applyLangChange = vi.fn();

    motor.setLang('en');

    // On mobile / low-tier, the blur is NOT applied to the viewport
    expect(viewport.style.filter).not.toContain('blur');
  });

  it('on a desktop high-tier PC, the language change uses blur in the viewport', () => {
    const motor = new ImageEngine(host as any);
    motor._deviceProfile = {
      tier: 'high',
      isMobile: false,
      prefersReducedMotion: false,
      cores: 16,
      saveData: false,
    };

    const shadow = host.attachShadow({ mode: 'open' });
    const viewport = document.createElement('div');
    viewport.className = 'oim-player-viewport';
    shadow.appendChild(viewport);
    motor._viewport = viewport;

    motor._classifyLangChange = () => ({
      styleOnly: new Set<string>(),
      content: new Set(['titulo']),
    });
    motor._applyLangChange = vi.fn();

    motor.setLang('en');

    // On desktop high-tier, the soft cinematic blur is applied
    expect(viewport.style.filter).toContain('blur(14px)');
  });

  it('respects a manual tier="low" attribute on the host by downgrading to a soft fade', () => {
    host.setAttribute('tier', 'low');
    const motor = new ImageEngine(host as any);
    motor._deviceProfile = {
      tier: 'high',
      isMobile: false,
      prefersReducedMotion: false,
      cores: 16,
      saveData: false,
    };

    expect(motor._isLowTierOrMobile()).toBe(true);

    const shadow = host.attachShadow({ mode: 'open' });
    const viewport = document.createElement('div');
    viewport.className = 'oim-player-viewport';
    shadow.appendChild(viewport);
    motor._viewport = viewport;

    motor._classifyLangChange = () => ({
      styleOnly: new Set<string>(),
      content: new Set(['titulo']),
    });
    motor._applyLangChange = vi.fn();

    motor.setLang('en');
    expect(viewport.style.filter).not.toContain('blur');
  });
});
