/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParallaxSlotItem {
  id: string;
  element: HTMLElement;
  depth: number;
  mode?: 'mouse' | 'scroll';
  axis: 'both' | 'x_only' | 'y_only';
}

export class ParallaxController {
  private containerEl: HTMLElement;
  private items: ParallaxSlotItem[] = [];
  private rafId: number | null = null;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private targetMouseX: number = 0;
  private targetMouseY: number = 0;
  private isHovered: boolean = false;
  private isPaused: boolean = false;
  private lastTimeMs: number = 0;

  // A paused controller does not measure: in a gallery every card has one, and
  // reading the layout of each card on every pointer event is what stalls a
  // scroll.
  private handleMouseMove = (e: MouseEvent) => {
    if (this.isPaused) return;
    const rect = this.containerEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const isInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    this.isHovered = isInside;
    if (isInside) {
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      this.targetMouseX = Math.max(-0.5, Math.min(0.5, relX));
      this.targetMouseY = Math.max(-0.5, Math.min(0.5, relY));
      this.startLoop();
    } else {
      this.targetMouseX = 0;
      this.targetMouseY = 0;
      this.startLoop();
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.isPaused) return;
    const rect = this.containerEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const isInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    this.isHovered = isInside;
    if (isInside) {
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      this.targetMouseX = Math.max(-0.5, Math.min(0.5, relX));
      this.targetMouseY = Math.max(-0.5, Math.min(0.5, relY));
      this.startLoop();
    } else if (e.pointerType !== 'touch') {
      this.targetMouseX = 0;
      this.targetMouseY = 0;
      this.startLoop();
    }
  };

  private handlePointerUp = () => {
    this.isHovered = false;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.startLoop();
  };

  private handleMouseEnter = () => {
    this.isHovered = true;
    this.startLoop();
  };

  private handleMouseLeave = () => {
    this.isHovered = false;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.startLoop();
  };

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
      window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
      window.addEventListener('pointerup', this.handlePointerUp, { passive: true });
      window.addEventListener('pointercancel', this.handlePointerUp, { passive: true });
    }
    this.containerEl.addEventListener('mouseenter', this.handleMouseEnter);
    this.containerEl.addEventListener('mouseleave', this.handleMouseLeave);
    this.startLoop();
  }

  public registerSlot(item: ParallaxSlotItem): void {
    this.items.push(item);
  }

  /**
   * Repoints an already-registered layer to its new node.
   *
   * Needed when the canvas rebuilds ONE layer (for example when switching
   * language): the old node gets detached, and without this the controller
   * would keep moving it. The new layer would never move, silently.
   */
  public retarget(id: string, element: HTMLElement): boolean {
    let found = false;
    for (const item of this.items) {
      if (item.id === id) {
        item.element = element;
        found = true;
      }
    }
    return found;
  }

  public pause(): void {
    this.isPaused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public play(): void {
    this.isPaused = false;
    this.startLoop();
  }

  private startLoop(): void {
    if (this.isPaused) return;
    if (this.rafId !== null) return;

    const loop = (timestamp: number) => {
      if (this.isPaused) {
        this.rafId = null;
        return;
      }

      if (!this.lastTimeMs) this.lastTimeMs = timestamp;
      const dt = (timestamp - this.lastTimeMs) / 1000;
      this.lastTimeMs = timestamp;

      // Exponential smoothing, independent of the screen's FPS
      // (at 60Hz dt~0.0166s gives factor~0.10; at 30Hz or 120/144Hz it moves at the same real-time speed)
      const factor = dt > 0 ? 1 - Math.exp(-6.5 * Math.min(dt, 0.1)) : 0.1;
      this.mouseX += (this.targetMouseX - this.mouseX) * factor;
      this.mouseY += (this.targetMouseY - this.mouseY) * factor;

      for (const item of this.items) {
        if (!item.element) continue;

        let offsetX = 0;
        let offsetY = 0;

        // Mouse Parallax Offset (Max +- 60px scaled by depth)
        const maxOffsetPx = 60 * item.depth;
        if (item.axis === 'both' || item.axis === 'x_only') {
          offsetX += this.mouseX * maxOffsetPx;
        }
        if (item.axis === 'both' || item.axis === 'y_only') {
          offsetY += this.mouseY * maxOffsetPx;
        }

        item.element.style.setProperty('--oim-px', `${offsetX.toFixed(2)}px`);
        item.element.style.setProperty('--oim-py', `${offsetY.toFixed(2)}px`);
      }

      // Go idle when still and the pointer is not interacting
      const diffX = Math.abs(this.targetMouseX - this.mouseX);
      const diffY = Math.abs(this.targetMouseY - this.mouseY);
      if (diffX < 0.001 && diffY < 0.001 && !this.isHovered) {
        this.mouseX = this.targetMouseX;
        this.mouseY = this.targetMouseY;
        this.rafId = null;
        return;
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('pointermove', this.handlePointerMove);
      window.removeEventListener('pointerup', this.handlePointerUp);
      window.removeEventListener('pointercancel', this.handlePointerUp);
    }
    this.containerEl.removeEventListener('mouseenter', this.handleMouseEnter);
    this.containerEl.removeEventListener('mouseleave', this.handleMouseLeave);
    this.items = [];
  }
}

