import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveAnimationTiming } from "../src/core/timing.js";

afterEach(() => vi.unstubAllGlobals());

describe("animation timing", () => {
  it.each([-1, NaN, Infinity])("rejects invalid duration %s", (duration) => {
    expect(() => resolveAnimationTiming(duration, "linear")).toThrow(
      RangeError,
    );
  });
  it("accepts zero duration and caller-supplied easing", () => {
    expect(resolveAnimationTiming(0, "ease-out")).toEqual({
      duration: 0,
      easing: "ease-out",
    });
  });
  it("rejects empty easing and browser-invalid syntax", () => {
    expect(() => resolveAnimationTiming(350, "")).toThrow(TypeError);
    vi.stubGlobal("CSS", { supports: () => false });
    expect(() => resolveAnimationTiming(350, "invalid")).toThrow(TypeError);
  });
});
