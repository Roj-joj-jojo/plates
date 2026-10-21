"use client";

import * as React from "react";

/*
 * Publishes the visible area as CSS variables on <html>:
 *   --vvh     visual viewport height (shrinks when the on-screen keyboard opens)
 *   --vv-top  visual viewport offset from the top of the layout viewport
 *
 * The visual and layout viewports can differ. On iOS Safari the keyboard does not resize the layout
 * viewport; it covers it and can scroll the visual viewport. TableShell uses these variables to size
 * and position the whole screen to the visible area, so the composer sits just above the keyboard.
 * See https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 */
export function useVisualViewportVars() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const previousKeyboard = root.dataset.keyboardOpen;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--vvh", `${vv.height}px`);
        root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
        root.dataset.keyboardOpen = String(vv.scale === 1 && window.innerHeight - vv.height > 150);
      });
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vv-top");
      if (previousKeyboard === undefined) delete root.dataset.keyboardOpen;
      else root.dataset.keyboardOpen = previousKeyboard;
    };
  }, []);
}
