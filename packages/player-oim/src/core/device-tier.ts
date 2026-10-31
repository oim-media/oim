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
 * Detecta si el dispositivo es un móvil o tableta táctil.
 */
export function isMobileDevice(nav?: Navigator, win?: Window): boolean {
  const n = nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const w = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!n) return false;

  // 1. User Agent regex estándar
  const ua = n.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // 2. iPadOS en Safari simula MacIntel con múltiples puntos táctiles
  if (n.platform === 'MacIntel' && n.maxTouchPoints > 1) {
    return true;
  }

  // 3. Pantalla táctil sin ratón fino
  if (n.maxTouchPoints > 1 && w && typeof w.matchMedia === 'function') {
    try {
      const hasFinePointer = w.matchMedia('(pointer: fine)').matches;
      const canHover = w.matchMedia('(hover: hover)').matches;
      if (!hasFinePointer && !canHover) {
        return true;
      }
    } catch {
      // Ignorar si matchMedia falla en entornos restringidos
    }
  }

  return false;
}

/**
 * Detecta si el sistema operativo tiene activada la preferencia de movimiento reducido.
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
 * Determina el nivel de rendimiento (tier) del hardware disponible.
 * - 'low': móviles gama baja, <=2 núcleos, <=2GB RAM, o ahorro de datos activo.
 * - 'medium': móviles estándar, 4-6 núcleos, portátiles en batería.
 * - 'high': PCs de escritorio con >=8 núcleos y >=8GB RAM.
 */
export function getDeviceTier(nav?: Navigator, win?: Window): DeviceTier {
  const n = nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const w = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!n) return 'high';

  // 1. Modo ahorro de datos activo -> 'low'
  const conn = (n as any).connection;
  if (conn && conn.saveData === true) {
    return 'low';
  }

  // 2. Memoria del dispositivo (API deviceMemory en Chrome/Edge)
  const memory = (n as any).deviceMemory;
  if (typeof memory === 'number' && memory <= 2) {
    return 'low';
  }

  // 3. Concurrencia de hardware (núcleos de CPU)
  const cores = n.hardwareConcurrency || 4;
  if (cores <= 2) {
    return 'low';
  }

  const isMobile = isMobileDevice(n, w);

  if (isMobile) {
    // En móviles, incluso con 8 núcleos pequeños, el presupuesto térmico
    // y de shaders corresponde a medium/low frente a una PC de escritorio.
    if (cores <= 4 || (typeof memory === 'number' && memory <= 4)) {
      return 'low';
    }
    return 'medium';
  }

  // En PC de escritorio o portátiles potentes
  if (cores >= 8 && (typeof memory !== 'number' || memory >= 8)) {
    return 'high';
  }

  return 'medium';
}

/**
 * Retorna el perfil consolidado del dispositivo.
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
