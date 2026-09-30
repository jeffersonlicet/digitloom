/** @fileoverview Caches bounded glyph bitmaps and native text positions. */
import type { Atlas, Glyph } from "./canvas.types.js";
export const atlases = new Map<string, Atlas>();
export function glyph(atlas: Atlas, text: string): Glyph {
  const cached = atlas.glyphs.get(text);
  if (cached) return cached;
  const canvas = atlas.owner.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  context.font = atlas.typeface;
  context.fontKerning = "none";
  context.letterSpacing = `${atlas.spacing}px`;
  const metrics = context.measureText(text);
  const width = metrics.width;
  canvas.width = Math.ceil(
    (Math.max(width, metrics.actualBoundingBoxRight) + 4) * atlas.ratio,
  );
  canvas.height = Math.ceil(atlas.lineHeight * atlas.ratio);
  context.scale(atlas.ratio, atlas.ratio);
  context.font = atlas.typeface;
  context.fontKerning = "none";
  context.letterSpacing = `${atlas.spacing}px`;
  context.fillStyle = atlas.ink;
  context.fillText(text, 2, atlas.baseline);
  const result = {
    canvas,
    inkTop: atlas.baseline - metrics.actualBoundingBoxAscent,
    inkBottom: atlas.baseline + metrics.actualBoundingBoxDescent,
  };
  if (atlas.glyphs.size >= 128) atlas.glyphs.clear();
  atlas.glyphs.set(text, result);
  return result;
}
