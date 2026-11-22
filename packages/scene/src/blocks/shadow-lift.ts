/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A CSS mask cuts the element's own `filter` too, so a drop-shadow (shadow or glow) of a
 * figure masked to its silhouette (a gradient, pattern or generative fill) was cut away.
 * Such a layer draws its filter on a wrapper outside the mask, of the same box as its
 * parent, so positions in % and container units do not change.
 *
 * Returns the node that takes the layer's place in its parent: the wrapper or the layer.
 */
export function liftShadow(el: HTMLElement, filter: string): HTMLElement {
  const masked = !!(el.style.getPropertyValue("mask-image") || el.style.getPropertyValue("-webkit-mask-image"));
  const parent = el.parentElement;
  const wrap = parent?.hasAttribute("data-oim-shadow-lift") ? parent : null;
  if (masked && filter.includes("drop-shadow")) {
    const lift = wrap ?? el.ownerDocument.createElement("div");
    if (!wrap) {
      lift.setAttribute("data-oim-shadow-lift", "");
      // The wrapper only paints: it covers the parent, so it must not take the pointer.
      Object.assign(lift.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none" });
      parent?.insertBefore(lift, el);
      lift.appendChild(el);
    }
    lift.style.filter = filter;
    el.style.filter = "";
    el.style.pointerEvents = "auto";
    return lift;
  }
  el.style.filter = filter;
  if (wrap) {
    wrap.replaceWith(el);
    el.style.pointerEvents = "";
  }
  return el;
}
