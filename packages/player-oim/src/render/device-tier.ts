/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type DeviceTier = 'high' | 'medium' | 'low';

export interface DeviceProfile {
  tier: DeviceTier;
  isMobile: boolean;
  prefersReducedMotion: boolean;
  cores: number;
  memoryGb?: number;
  saveData: boolean;
}

/**
 * Detects whether the device is a mobile or touch tablet.
 */
export function isMobileDevice(nav?: Navigator, win?: Window): boolean {
  const n = nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const w = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!n) return false;

  // 1. Standard User Agent regex
  const ua = n.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // 2. iPadOS in Safari reports itself as MacIntel with several touch points
  if (n.platform === 'MacIntel' && n.maxTouchPoints > 1) {
    return true;
  }

  // 3. Touch screen without a fine pointer (mouse)
  if (n.maxTouchPoints > 1 && w && typeof w.matchMedia === 'function') {
    try {
      const hasFinePointer = w.matchMedia('(pointer: fine)').matches;
      const canHover = w.matchMedia('(hover: hover)').matches;
      if (!hasFinePointer && !canHover) {
        return true;
      }
    } catch {
      // Ignore if matchMedia fails in restricted environments
    }
  }

  return false;
}

/**
 * Detects whether the operating system has the reduced-motion preference enabled.
 */
export function prefersReducedMotion(win?: Window): boolean {
  const w = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!w || typeof w.matchMedia !== 'function') return false;
  try {
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Determines the performance level (tier) of the available hardware.
 * - 'low': low-end phones, <=2 cores, <=2GB RAM, or data saver active.
 * - 'medium': standard phones, 4-6 cores, laptops on battery.
 * - 'high': desktop PCs with >=8 cores and >=8GB RAM.
 */
export function getDeviceTier(nav?: Navigator, win?: Window): DeviceTier {
  const n = nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const w = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!n) return 'high';

  // 1. Data saver mode active -> 'low'
  const conn = (n as any).connection;
  if (conn && conn.saveData === true) {
    return 'low';
  }

  // 2. Device memory (deviceMemory API in Chrome/Edge)
  const memory = (n as any).deviceMemory;
  if (typeof memory === 'number' && memory <= 2) {
    return 'low';
  }

  // 3. Hardware concurrency (CPU cores)
  const cores = n.hardwareConcurrency || 4;
  if (cores <= 2) {
    return 'low';
  }

  const isMobile = isMobileDevice(n, w);

  if (isMobile) {
    // On phones, even with 8 small cores, the thermal and shader budget
    // belongs to medium/low, compared with a desktop PC.
    if (cores <= 4 || (typeof memory === 'number' && memory <= 4)) {
      return 'low';
    }
    return 'medium';
  }

  // On desktop PCs or powerful laptops
  if (cores >= 8 && (typeof memory !== 'number' || memory >= 8)) {
    return 'high';
  }

  return 'medium';
}

/**
 * Returns the consolidated profile of the device.
 */
export function getDeviceProfile(nav?: Navigator, win?: Window): DeviceProfile {
  const n = nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const w = win ?? (typeof window !== 'undefined' ? window : undefined);
  return {
    tier: getDeviceTier(n, w),
    isMobile: isMobileDevice(n, w),
    prefersReducedMotion: prefersReducedMotion(w),
    cores: n?.hardwareConcurrency || 4,
    memoryGb: (n as any)?.deviceMemory,
    saveData: Boolean((n as any)?.connection?.saveData),
  };
}
