/** @fileoverview Reads shared browser clocks once per paint batch. */
import type { Clock } from "./canvas.types.js";
/** Returns the eased progress without restarting an existing digit roll. */
export function motionProgress(
  clock?: Clock | null,
  cache?: Map<Clock, number>,
): number {
  if (!clock || clock.animation.playState === "finished") return 1;
  let progress = cache?.get(clock);
  if (progress === undefined) {
    progress = Number(
      clock.animation.effect?.getComputedTiming().progress ?? 1,
    );
    cache?.set(clock, progress);
  }
  return progress;
}
