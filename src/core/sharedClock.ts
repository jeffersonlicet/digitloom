/** @fileoverview Shares browser timing between immediate and staggered digit rolls. */
import type { Clock } from "./canvas.types.js";

function createClock(
  timeline: DocumentTimeline,
  duration: number,
  easing: string,
  delay = 0,
): Clock {
  const animation = new Animation(
    new KeyframeEffect(null, [], { duration, easing, delay, fill: "both" }),
    timeline,
  );
  animation.currentTime = 0;
  animation.play();
  return { animation, users: 0 };
}

/** Shares the normal phase across all counters with the same timing in a batch. */
export function sharedClock(
  clocks: Map<string, Clock>,
  timeline: DocumentTimeline,
  duration: number,
  easing: string,
): Clock {
  const key = `${duration}|${easing}`;
  let clock = clocks.get(key);
  if (!clock) {
    clock = createClock(timeline, duration, easing);
    clocks.set(key, clock);
  }
  return clock;
}

/** Reuses one delayed phase without rebuilding long easing keys for each digit. */
export function staggerClock(
  clock: Clock,
  timeline: DocumentTimeline,
  duration: number,
  easing: string,
): Clock {
  return (clock.stagger ??= createClock(
    timeline,
    duration,
    easing,
    Math.min(24, duration / 10),
  ));
}
