/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isMobileDevice,
  prefersReducedMotion,
  getDeviceTier,
  getDeviceProfile,
} from './device-tier';

describe('device-tier utility', () => {
  it('detecta dispositivos móviles por User Agent estándar', () => {
    const fakeNavIphone = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5,
    } as any;
    expect(isMobileDevice(fakeNavIphone)).toBe(true);

    const fakeNavAndroid = {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    } as any;
    expect(isMobileDevice(fakeNavAndroid)).toBe(true);
  });

  it('detecta iPadOS que simula MacIntel con puntos táctiles', () => {
    const fakeNavIpad = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    } as any;
    expect(isMobileDevice(fakeNavIpad)).toBe(true);
  });

  it('detecta PC de escritorio con ratón fino', () => {
    const fakeNavDesktop = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      platform: 'Win32',
      maxTouchPoints: 0,
    } as any;
    const fakeWinDesktop = {
      matchMedia: (q: string) => ({ matches: q.includes('pointer: fine') }),
    } as any;
    expect(isMobileDevice(fakeNavDesktop, fakeWinDesktop)).toBe(false);
  });

  it('detecta preferencia de movimiento reducido', () => {
    const winReduced = {
      matchMedia: (q: string) => ({ matches: q.includes('prefers-reduced-motion') }),
    } as any;
    expect(prefersReducedMotion(winReduced)).toBe(true);

    const winNormal = {
      matchMedia: () => ({ matches: false }),
    } as any;
    expect(prefersReducedMotion(winNormal)).toBe(false);
  });

  it('asigna tier "low" si el modo ahorro de datos está activo', () => {
    const fakeNav = {
      userAgent: 'Desktop',
      hardwareConcurrency: 16,
      connection: { saveData: true },
    } as any;
    expect(getDeviceTier(fakeNav)).toBe('low');
  });

  it('asigna tier "low" si la memoria es <= 2GB o núcleos <= 2', () => {
    const fakeNavLowMem = {
      userAgent: 'Desktop',
      hardwareConcurrency: 8,
      deviceMemory: 2,
    } as any;
    expect(getDeviceTier(fakeNavLowMem)).toBe('low');

    const fakeNavLowCpu = {
      userAgent: 'Desktop',
      hardwareConcurrency: 2,
      deviceMemory: 8,
    } as any;
    expect(getDeviceTier(fakeNavLowCpu)).toBe('low');
  });

  it('asigna tier "high" a PCs con >=8 núcleos y >=8GB de RAM', () => {
    const fakeNavDesktop = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0,
    } as any;
    const fakeWin = {
      matchMedia: () => ({ matches: false }),
    } as any;
    expect(getDeviceTier(fakeNavDesktop, fakeWin)).toBe('high');
  });

  it('asigna tier "low" o "medium" a móviles según sus núcleos/RAM', () => {
    const fakeNavMobileLow = {
      userAgent: 'Mozilla/5.0 (Android; Mobile)',
      hardwareConcurrency: 4,
      deviceMemory: 3,
      maxTouchPoints: 5,
    } as any;
    expect(getDeviceTier(fakeNavMobileLow)).toBe('low');

    const fakeNavMobileMid = {
      userAgent: 'Mozilla/5.0 (iPhone)',
      hardwareConcurrency: 6,
      deviceMemory: 6,
      maxTouchPoints: 5,
    } as any;
    expect(getDeviceTier(fakeNavMobileMid)).toBe('medium');
  });

  it('genera el perfil consolidado getDeviceProfile correctamente', () => {
    const fakeNav = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      hardwareConcurrency: 12,
      deviceMemory: 32,
      maxTouchPoints: 0,
      connection: { saveData: false },
    } as any;
    const fakeWin = {
      matchMedia: () => ({ matches: false }),
    } as any;

    const profile = getDeviceProfile(fakeNav, fakeWin);
    expect(profile.tier).toBe('high');
    expect(profile.isMobile).toBe(false);
    expect(profile.prefersReducedMotion).toBe(false);
    expect(profile.cores).toBe(12);
    expect(profile.memoryGb).toBe(32);
    expect(profile.saveData).toBe(false);
  });
});
