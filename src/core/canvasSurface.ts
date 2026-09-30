/** @fileoverview Owns one visible canvas and layout observers per counter group. */
import type { Surface } from "./canvas.types.js";
import { atlases } from "./glyphAtlas.js";
export const surfaces = new WeakMap<HTMLElement, Surface>();
export function getSurface(grid: HTMLElement): Surface {
  const existing = surfaces.get(grid);
  if (existing) {
    existing.clients += 1;
    return existing;
  }
  const document = grid.ownerDocument;
  const window = document.defaultView;
  if (!window) throw new Error("Digitloom requires a browser document.");
  const canvas = document.createElement("canvas");
  canvas.width = 0;
  canvas.height = 0;
  canvas.className = "rolling-number__canvas";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  grid.appendChild(canvas);
  const surface: Surface = {
    canvas,
    context,
    clients: 1,
    bleed: 8,
    ratio: window.devicePixelRatio,
    motions: new Set(),
    stopLayout: () => {},
    onScroll: () => {
      surface.motions.forEach((motion) => motion.settle());
    },
  };
  document.addEventListener("scroll", surface.onScroll, {
    passive: true,
    capture: true,
  });
  const refresh = () => {
    surface.motions.forEach((motion) => motion.refresh());
  };
  const resized = new window.ResizeObserver(refresh);
  resized.observe(grid);
  const changed = new window.MutationObserver(refresh);
  for (
    let ancestor: Element | null = grid;
    ancestor;
    ancestor = ancestor.parentElement
  )
    changed.observe(ancestor, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  let pixels = window.matchMedia(
    `(resolution: ${window.devicePixelRatio}dppx)`,
  );
  const zoomed = () => {
    pixels.removeEventListener("change", zoomed);
    pixels = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    pixels.addEventListener("change", zoomed);
    refresh();
  };
  pixels.addEventListener("change", zoomed);
  window.visualViewport?.addEventListener("resize", refresh);
  const fontsLoaded = () => {
    atlases.clear();
    refresh();
  };
  document.fonts.addEventListener("loadingdone", fontsLoaded);
  surface.stopLayout = () => {
    window.visualViewport?.removeEventListener("resize", refresh);
    document.removeEventListener("scroll", surface.onScroll, true);
    resized.disconnect();
    changed.disconnect();
    pixels.removeEventListener("change", zoomed);
    document.fonts.removeEventListener("loadingdone", fontsLoaded);
  };
  surfaces.set(grid, surface);
  return surface;
}
