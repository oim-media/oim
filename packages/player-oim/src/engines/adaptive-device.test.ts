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

describe('Adaptación inteligente de rendimiento (Device Tiering)', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it('en dispositivo móvil o low-tier, el cambio de idioma usa fundido sin blur en el viewport', () => {
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

  it('en PC de escritorio high-tier, el cambio de idioma usa blur en el viewport', () => {
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

  it('respeta el atributo tier="low" manual en el host degradando a fundido suave', () => {
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
