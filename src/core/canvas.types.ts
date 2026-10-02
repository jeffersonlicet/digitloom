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
  advance: number;
  inkTop: number;
  inkBottom: number;
}
export type Clip = [number, number, number, number];
export interface Atlas {
  owner: Document;
  glyphs: Map<string, Glyph>;
  typeface: string;
  ink: string;
  lineHeight: number;
  ratio: number;
  baseline: number;
  spacing: number;
  advances: Map<string, number>;
}
export type Cell = {
  place: string;
  text: string;
  x: number;
  width: number;
  offsetX?: number;
} & (
  | { to?: undefined; rolls?: undefined }
  | { to: number; rolls: { delta: number; clock: Clock }[] }
);
export interface Surface {
  pixels: Partial<Record<"left" | "top" | "width" | "height", number>>;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  bleed: number;
  leftBleed: number;
  layoutChanges: Set<HTMLElement>;
  motions: Set<CanvasMotion>;
  stopLayout: () => void;
}
export interface Clock {
  animation: Animation;
  users: number;
  stagger?: Clock;
}
