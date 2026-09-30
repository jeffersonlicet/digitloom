/** @fileoverview Owns one visible canvas and layout observers per counter group. */
import type { Surface } from "./canvas.types.js";
import { atlases } from "./glyphAtlas.js";
export const surfaces = new WeakMap<HTMLElement, Surface>();
function withoutOpacity(style: string) {
  return style.replace(/(?:^|;)\s*opacity\s*:[^;]*/g, "");
}
export function getSurface(grid: HTMLElement): Surface {
  const existing = surfaces.get(grid);
  if (existing) return existing;
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
  const onScroll = () => {
    surface.motions.forEach((motion) => motion.settle());
  };
  const surface: Surface = {
    pixels: {},
    canvas,
    context,
    bleed: 8,
    leftBleed: 0,
    motions: new Set(),
    stopLayout: () => {
      window.visualViewport?.removeEventListener("resize", refresh);
      document.removeEventListener("scroll", onScroll, true);
      resized.disconnect();
      changed.disconnect();
      pixels.removeEventListener("change", zoomed);
      document.fonts.removeEventListener("loadingdone", fontsLoaded);
    },
  };
  document.addEventListener("scroll", onScroll, {
    passive: true,
    capture: true,
  });
  const refresh = () => {
    surface.motions.forEach((motion) => motion.refresh());
  };
  const resized = new window.ResizeObserver(refresh);
  resized.observe(grid);
  const changed = new window.MutationObserver((records) => {
    const layoutChanged = records.some((record) => {
      if (record.target === canvas) return false;
      if (record.attributeName !== "style") return true;
      const current = (record.target as Element).getAttribute("style") ?? "";
      return withoutOpacity(record.oldValue ?? "") !== withoutOpacity(current);
    });
    if (layoutChanged) refresh();
  });
  for (
    let ancestor: Element | null = grid;
    ancestor;
    ancestor = ancestor.parentElement
  )
    changed.observe(ancestor, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["class", "style"],
      subtree: ancestor === grid,
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
  surfaces.set(grid, surface);
  return surface;
}

/** Updates display geometry without generating redundant style mutations. */
export function setCanvasPixels(
  surface: Surface,
  property: "left" | "top" | "width" | "height",
  value: number,
) {
  if (surface.pixels[property] === value) return;
  surface.pixels[property] = value;
  surface.canvas.style[property] = `${value}px`;
}
