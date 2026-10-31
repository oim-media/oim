/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts the Python backend's `slots_raw` into the `slots` the renderer paints.
 * Runs AFTER signature validation: mutating before would break the signature.
 *
 * The worker and the main thread used to carry their own copies, and they
 * disagreed on where a centred layer goes. Variant W anchors on (x_px, y_px)
 * without adding width_px/2: the renderer (ImageEngine.ts ~2003) already compensates
 * by adding wRef/2 and hRef/2 for text alignment, and the Python backend (media.py:440)
 * compiles slots_raw using (x_px / w_canvas, y_px / h_canvas) directly.
 */
export function normalizeRawSlots(meta: any): void {
  const artboardW = meta.artboardWidth || meta.canvasWidth || meta.canvas_width || 1080;
  const artboardH = meta.artboardHeight || meta.canvasHeight || meta.canvas_height || 1920;

  if (Array.isArray(meta.slots_raw) && !Array.isArray(meta.slots)) {
    meta.slots = meta.slots_raw.map((s: any) => {
      const xRef = s.x_px ?? s.x ?? 0;
      const yRef = s.y_px ?? s.y ?? 0;
      const wRef = s.width_px ?? s.width ?? 0;
      const hRef = s.height_px ?? s.height ?? 0;
      const align = s.align || 'left';

      // Variant W: anchor on top-left (x_px, y_px). The renderer (ImageEngine.ts ~2003)
      // already adds wRef/2 and hRef/2 for centered text, and the backend (media.py:440)
      // assigns position: [x_px/w, y_px/h] directly.
      const anchorX = xRef;
      const anchorY = yRef;

      const xPercent = artboardW > 0 ? (anchorX / artboardW) * 100 : 0;
      const yPercent = artboardH > 0 ? (anchorY / artboardH) * 100 : 0;

      const style = s.style || {};
      style.width = style.width || (wRef + 'px');
      style.height = style.height || (hRef + 'px');
      if (s.border_radius_px !== undefined && style.borderRadius === undefined) {
        style.borderRadius = s.border_radius_px + 'px';
      }
      if (style.borderRadiusTL !== undefined) {
        style.borderTopLeftRadius = style.borderRadiusTL + 'px';
        style.borderTopRightRadius = style.borderRadiusTR + 'px';
        style.borderBottomLeftRadius = style.borderRadiusBL + 'px';
        style.borderBottomRightRadius = style.borderRadiusBR + 'px';
      }

      return {
        ...s,
        x: xRef,
        y: yRef,
        width: wRef,
        height: hRef,
        width_px: wRef,
        height_px: hRef,
        align,
        fontSize: s.fontSize ?? s.font_size_px ?? 16,
        position: [xPercent, yPercent],
        style
      };
    });
  }
  if (Array.isArray(meta.languages) && !Array.isArray(meta.lang)) {
    meta.lang = meta.languages;
  }
}
