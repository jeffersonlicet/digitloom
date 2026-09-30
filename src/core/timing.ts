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
    throw new RangeError(
      "Digitloom duration must be a finite, nonnegative number.",
    );
  if (typeof easing !== "string" || !easing.trim())
    throw new TypeError("Digitloom easing must be a CSS easing string.");
  if (
    typeof CSS !== "undefined" &&
    !CSS.supports("animation-timing-function", easing)
  )
    throw new TypeError("Digitloom easing must be a valid CSS easing value.");
  return { duration, easing };
}
