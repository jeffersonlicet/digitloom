/** @fileoverview Defines contracts between canvas motion collaborators. */
import type { CanvasMotion } from "./controller.js";
export interface Settings {
  value: string;
  duration: number;
  easing: string;
  animated: boolean;
  className?: string;
}
export interface Glyph {
  canvas: HTMLCanvasElement;
  inkTop: number;
  inkBottom: number;
}
export interface Atlas {
  document: Document;
  glyphs: Map<string, Glyph>;
  font: string;
  color: string;
  height: number;
  ratio: number;
  baseline: number;
  spacing: number;
  advances: Map<string, number>;
}
export interface Cell {
  key: string;
  text: string;
  from?: number;
  to?: number;
  x: number;
}
export interface Surface {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  clients: number;
  bleed: number;
  ratio: number;
  motions: Set<CanvasMotion>;
  onScroll: () => void;
  stopLayout: () => void;
}
export interface Clock {
  animation: Animation;
  users: number;
}
