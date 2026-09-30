import { describe, expect, it } from "vitest";
import { canvasViewport } from "../src/core/canvasViewport.js";
describe("canvas viewport bounds", () => {
  const viewport = { left: 0, top: 0, width: 800, height: 600 };
  it("bounds a long unscrolled list", () => {
    expect(
      canvasViewport(
        { left: 20, top: 100, width: 500, height: 20000 },
        viewport,
      ),
    ).toEqual({ left: 0, top: 0, width: 500, height: 500 });
  });
  it("crops a list after the window scrolls", () => {
    expect(
      canvasViewport(
        { left: 20, top: -1000, width: 500, height: 20000 },
        viewport,
      ),
    ).toEqual({ left: 0, top: 1000, width: 500, height: 600 });
  });
  it("retains smaller scroll areas", () => {
    expect(
      canvasViewport({ left: 20, top: 100, width: 500, height: 300 }, viewport),
    ).toEqual({ left: 0, top: 0, width: 500, height: 300 });
  });
  it("does not allocate pixels for a group outside the viewport", () => {
    expect(
      canvasViewport(
        { left: 900, top: 700, width: 500, height: 300 },
        viewport,
      ),
    ).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
