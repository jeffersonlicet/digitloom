/** @fileoverview Validates caller-supplied animation timing before browser updates. */
export interface AnimationTiming {
  duration: number;
  easing: string;
}

/** Rejects invalid timing instead of failing only after a visible value change. */
export function resolveAnimationTiming(
  duration: number,
  easing: string,
): AnimationTiming {
  if (!Number.isFinite(duration) || duration < 0)
    throw new RangeError("Use a finite duration >= 0.");
  if (
    typeof easing !== "string" ||
    !easing.trim() ||
    (typeof CSS !== "undefined" &&
      !CSS.supports("animation-timing-function", easing))
  )
    throw new TypeError("Use CSS easing.");
  return { duration, easing };
}
