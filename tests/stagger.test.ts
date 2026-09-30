// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasMotion } from "../src/core/controller.js";
import { atlases } from "../src/core/glyphAtlas.js";
import { createBrowserEnvironment } from "./browserEnvironment.js";

const mounted: CanvasMotion[] = [];
const timing = { animated: true, duration: 825, easing: "linear" };
afterEach(() => {
  mounted.splice(0).forEach((motion) => motion.destroy());
  atlases.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function counter(
  browser: ReturnType<typeof createBrowserEnvironment>,
  before: string,
  after: string,
  duration = 825,
) {
  const host = document.createElement("span");
  const text = document.createElement("span");
  text.className = "rolling-number__text";
  text.textContent = before;
  host.appendChild(text);
  document.body.appendChild(host);
  const motion = new CanvasMotion(host);
  mounted.push(motion);
  motion.update({ ...timing, duration, value: before });
  browser.show(host);
  text.textContent = after;
  motion.update({ ...timing, duration, value: after });
  return { motion, host, text };
}
function columns() {
  vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Range) {
      return {
        left: this.startOffset * 8,
        width: (this.endOffset - this.startOffset) * 8,
      } as DOMRect;
    },
  );
}
function progress(
  browser: ReturnType<typeof createBrowserEnvironment>,
  immediate: number,
  delayed: number,
) {
  browser.animations.forEach((animation, index) => {
    vi.spyOn(animation.effect, "getComputedTiming").mockReturnValue({
      progress: browser.timings[index].delay ? delayed : immediate,
    } as ComputedEffectTiming);
  });
}
function positions(
  browser: ReturnType<typeof createBrowserEnvironment>,
  motion: CanvasMotion,
  x: number,
) {
  browser.context.drawImage.mockClear();
  motion.draw();
  return browser.context.drawImage.mock.calls
    .filter(([, left]) => left === x)
    .map(([, , y]) => y);
}
describe("neighbor stagger", () => {
  it.each([
    ["11", "22"],
    ["22", "11"],
  ])(
    "separates equal neighboring travel from %s to %s",
    async (before, after) => {
      const browser = createBrowserEnvironment();
      columns();
      const { motion } = counter(browser, before, after);
      await Promise.resolve();
      expect(browser.timings.map(({ delay }) => delay)).toEqual([0, 24]);
      expect(browser.durations).toEqual([825, 825]);
      progress(browser, 0.5, 0);
      expect(positions(browser, motion, -2)).not.toEqual(
        positions(browser, motion, 6),
      );
      browser.animations.forEach((animation) => {
        animation.playState = "finished";
      });
      expect(positions(browser, motion, -2)).toEqual([0]);
      expect(positions(browser, motion, 6)).toEqual([0]);
    },
  );
  it("alternates phases across a longer equal run", async () => {
    const browser = createBrowserEnvironment();
    columns();
    const { motion } = counter(browser, "1111", "2222");
    await Promise.resolve();
    expect(browser.animations).toHaveLength(2);
    progress(browser, 0.5, 0.25);
    expect(positions(browser, motion, -2)).toEqual(
      positions(browser, motion, 14),
    );
    expect(positions(browser, motion, 6)).toEqual(
      positions(browser, motion, 22),
    );
    expect(positions(browser, motion, -2)).not.toEqual(
      positions(browser, motion, 6),
    );
  });
  it.each([
    ["12", "24"],
    ["12", "13"],
    ["1.1", "2.2"],
  ])(
    "does not stagger unequal, unchanged, or separated digits: %s → %s",
    async (before, after) => {
      const browser = createBrowserEnvironment();
      counter(browser, before, after);
      await Promise.resolve();
      expect(browser.timings.map(({ delay }) => delay)).toEqual([0]);
    },
  );
  it("caps delay for short motion and preserves zero-duration updates", async () => {
    const browser = createBrowserEnvironment();
    counter(browser, "11", "22", 100);
    await Promise.resolve();
    expect(browser.timings.map(({ delay }) => delay)).toEqual([0, 10]);
    const { host } = counter(browser, "11", "22", 0);
    await Promise.resolve();
    expect(browser.animations).toHaveLength(2);
    expect(host.dataset.rollingReady).toBeUndefined();
  });
  it("preserves a delayed roll during an interrupted value update", async () => {
    const browser = createBrowserEnvironment();
    columns();
    const { motion, text } = counter(browser, "11", "22");
    await Promise.resolve();
    progress(browser, 0.5, 0.25);
    const before = positions(browser, motion, 6);
    text.textContent = "33";
    motion.update({ ...timing, value: "33" });
    await Promise.resolve();
    browser.animations.slice(2).forEach((animation) => {
      vi.spyOn(animation.effect, "getComputedTiming").mockReturnValue({
        progress: 0,
      } as ComputedEffectTiming);
    });
    expect(positions(browser, motion, 6)).toEqual(before);
    expect(browser.animations[1].cancel).not.toHaveBeenCalled();
    vi.spyOn(browser.animations[1].effect, "getComputedTiming").mockReturnValue(
      { progress: 0.5 } as ComputedEffectTiming,
    );
    expect(positions(browser, motion, 6)).not.toEqual(before);
    motion.destroy();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
  it("shares only two clocks across 1,000 counters and cancels them once", async () => {
    const browser = createBrowserEnvironment();
    for (let index = 0; index < 1000; index += 1) counter(browser, "11", "22");
    await Promise.resolve();
    expect(browser.animations).toHaveLength(2);
    mounted.slice(0, -1).forEach((motion) => motion.destroy());
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 0,
      ),
    ).toBe(true);
    mounted[mounted.length - 1]?.destroy();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
});
