/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ImageEngine from './ImageEngine';
import '../index';

// The player's language when no `lang` is given is English (1.26.0). An explicit
// `lang` still wins, Spanish included.
describe('default language', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it('without a lang attribute the engine uses English', () => {
    const motor = new ImageEngine(host as any);
    expect(motor.lang).toBe('en');
  });

  it('an explicit lang="es" is still Spanish', () => {
    host.setAttribute('lang', 'es');
    const motor = new ImageEngine(host as any);
    expect(motor.lang).toBe('es');
  });

  it('an explicit lang="en" is English', () => {
    host.setAttribute('lang', 'en');
    const motor = new ImageEngine(host as any);
    expect(motor.lang).toBe('en');
  });

  it('the element reports English before any engine exists', () => {
    const player = document.createElement('oim-player') as any;
    expect(player.currentLang).toBe('en');
    expect(player.lang).toBe('en');
  });

  it('the element reports lang="es" before any engine exists', () => {
    const player = document.createElement('oim-player') as any;
    player.setAttribute('lang', 'es');
    expect(player.currentLang).toBe('es');
  });
});
