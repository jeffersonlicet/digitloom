/** @fileoverview Batches geometry reads and repaints each shared canvas once per frame. */
import type { CanvasMotion } from "./controller.js";
import type { Clock, Surface } from "./canvas.types.js";
export const active = new Set<CanvasMotion>();
export const pending = new Set<CanvasMotion>();
const dirty = new Set<Surface>();
let frame = 0;
let queued = false;

function repaint(surfaces: Set<Surface>) {
  const progress = new Map<Clock, number>();
  surfaces.forEach((surface) => {
    if (!surface.motions.size) return;
    const { context, canvas } = surface;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    surface.motions.forEach((motion) => motion.draw(progress));
  });
}
function tick() {
  frame = 0;
  repaint(new Set([...active].map((motion) => motion.surface)));
  if (active.size) frame = requestAnimationFrame(tick);
}
function queuePaint() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    const batch = [...pending];
    pending.clear();
    const prepared = batch.map((item) => item.prepare());
    const clocks = new Map<string, Clock>();
    batch.forEach((item, index) => {
      item.start(prepared[index], clocks);
      dirty.add(item.surface);
    });
    const surfaces = new Set(dirty);
    dirty.clear();
    repaint(surfaces);
    if (active.size && !frame) frame = requestAnimationFrame(tick);
  });
}
export function schedule(motion: CanvasMotion) {
  pending.add(motion);
  queuePaint();
}
/** Repaint surviving counters after visibility, disable, or unmount changes. */
export function invalidateSurface(surface: Surface) {
  dirty.add(surface);
  queuePaint();
}
/** Releases the shared frame when the last animation stops. */
export function stopIdleFrame() {
  if (!active.size && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}
