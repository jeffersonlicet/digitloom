/** @fileoverview Connects React text rendering to the browser animation controller. */
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MemoExoticComponent,
  type ReactElement,
} from "react";
import { CanvasMotion } from "./core/controller.js";
import { resolveAnimationTiming } from "./core/timing.js";

const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface RollingNumberProps {
  /** Exact formatted text. The renderer does not round or reformat it. */
  value: string;
  /** Allows updates to roll. Reduced motion and visibility still take precedence. */
  animated?: boolean;
  className?: string;
  /** Duration in milliseconds. Zero updates without motion. */
  duration?: number;
  /** A CSS easing value, including cubic-bezier() and steps(). */
  easing?: string;
}

/** Displays selectable text with browser-managed decorative digit motion. */
export const RollingNumber: MemoExoticComponent<
  (props: RollingNumberProps) => ReactElement
> = React.memo(function RollingNumber({
  value,
  animated = true,
  className = "",
  duration = 350,
  easing = "cubic-bezier(0.16,1,0.3,1)",
}: RollingNumberProps) {
  if (typeof value !== "string")
    throw new TypeError("Digitloom value must be a formatted string.");
  const timing = useMemo(
    () => resolveAnimationTiming(duration, easing),
    [duration, easing],
  );
  const visual = useRef<HTMLSpanElement>(null);
  const controller = useRef<CanvasMotion | null>(null);
  useBrowserLayoutEffect(() => {
    const element = visual.current;
    if (!element) return;
    const instance = new CanvasMotion(element);
    controller.current = instance;
    return () => {
      instance.destroy();
      controller.current = null;
    };
  }, []);
  useBrowserLayoutEffect(() => {
    controller.current?.update({ value, animated, ...timing });
  }, [animated, timing, value, className]);
  return (
    <span className={`rolling-number ${className}`} ref={visual}>
      <span className="rolling-number__text">{value}</span>
    </span>
  );
});
