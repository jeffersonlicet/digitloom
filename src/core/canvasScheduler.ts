/** @fileoverview Batches geometry reads and shares one animation frame across counters. */
import type { CanvasMotion } from "./controller.js";
import type { Clock } from "./canvas.types.js";
export const active = new Set<CanvasMotion>();
export const pending = new Set<CanvasMotion>();
let frame = 0;
let queued = false;

function tick() {
  frame = 0;
  const progress = new Map<Clock, number>();
  active.forEach((motion) => motion.draw(progress));
  if (active.size) frame = requestAnimationFrame(tick);
}
export function schedule(motion: CanvasMotion) {
  pending.add(motion);
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    const batch = [...pending];
    pending.clear();
    const prepared = batch.map((item) => item.prepare());
    const clocks = new Map<string, Clock>();
    batch.forEach((item, index) => item.start(prepared[index], clocks));
    const progress = new Map<Clock, number>();
    batch.forEach((item) => item.draw(progress));
    batch.forEach((item) => item.repaintSurface());
    if (active.size && !frame) frame = requestAnimationFrame(tick);
  });
}

/** Releases the shared frame when the last animation stops. */
export function stopIdleFrame() {
  if (!active.size && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}
