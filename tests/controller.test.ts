// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { atlases } from "../src/core/glyphAtlas.js";
import { CanvasMotion } from "../src/core/controller.js";
import { createBrowserEnvironment } from "./browserEnvironment.js";
const settings = {
  animated: true,
  duration: 350,
  easing: "linear",
  value: "12.00",
};
const mounted: CanvasMotion[] = [];
afterEach(() => {
  mounted.splice(0).forEach((controller) => controller.destroy());
  atlases.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function mount(group?: HTMLElement) {
  const host = document.createElement("span");
  host.className = "rolling-number";
  const text = document.createElement("span");
  text.className = "rolling-number__text";
  text.textContent = settings.value;
  host.appendChild(text);
  (group ?? document.body).appendChild(host);
  const controller = new CanvasMotion(host);
  mounted.push(controller);
  return { host, text, controller };
}
function setProgress(
  animation: ReturnType<typeof createBrowserEnvironment>["animations"][number],
  progress: number,
) {
  vi.spyOn(animation.effect, "getComputedTiming").mockReturnValue({
    progress,
  } as ComputedEffectTiming);
}
function digitPositions(
  browser: ReturnType<typeof createBrowserEnvironment>,
  controller: CanvasMotion,
  x: number,
) {
  browser.context.drawImage.mockClear();
  controller.draw();
  return browser.context.drawImage.mock.calls
    .filter(([, left]) => left === x)
    .map(([canvas, , y]) => ({ canvas, y }));
}
function nativeColumns() {
  vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Range) {
      return {
        left:
          (this.startContainer.parentElement?.parentElement?.getBoundingClientRect()
            .left ?? 0) +
          this.startOffset * 8,
        width: (this.endOffset - this.startOffset) * 8,
      } as DOMRect;
    },
  );
}
describe("motion continuity", () => {
  it("restores native text and clears settled glyphs after natural completion", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    browser.animations.forEach((animation) => {
      animation.playState = "finished";
    });
    browser.context.drawImage.mockClear();
    browser.context.clearRect.mockClear();
    const frame = vi.mocked(requestAnimationFrame).mock.calls.slice(-1)[0]?.[0];
    frame?.(825);
    await Promise.resolve();
    expect(host.dataset.rollingReady).toBeUndefined();
    expect(browser.context.drawImage).not.toHaveBeenCalled();
    expect(browser.context.clearRect).toHaveBeenCalledOnce();
  });

  it("restores one shared counter while its neighbor continues rolling", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    document.body.appendChild(group);
    const first = mount(group);
    const second = mount(group);
    browser.show(first.host);
    browser.show(second.host);
    first.controller.update(settings);
    second.controller.update({ ...settings, duration: 200 });
    await Promise.resolve();
    browser.animations.forEach((animation, index) => {
      if (browser.durations[index] === 200) animation.playState = "finished";
    });
    browser.context.drawImage.mockClear();
    const frame = vi.mocked(requestAnimationFrame).mock.calls.slice(-1)[0]?.[0];
    frame?.(200);
    expect(second.host.dataset.rollingReady).toBeUndefined();
    expect(first.host.dataset.rollingReady).toBe("");
    expect(browser.context.drawImage).toHaveBeenCalled();
    expect(
      browser.animations.find((_, index) => browser.durations[index] === 350)
        ?.cancel,
    ).not.toHaveBeenCalled();
  });
  it("updates fractional CSS dimensions without reallocating the backing store", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    const prepared = controller.prepare();
    if (!prepared) throw new Error("The counter geometry was not prepared.");
    const clocks = new Map();
    controller.start(
      {
        ...prepared,
        gridWidth: 100.2,
        gridHeight: 20.2,
        leftLimit: 0,
        rightLimit: 0,
      },
      clocks,
    );
    const canvas = controller.surface.canvas;
    const dimensions = [canvas.width, canvas.height];
    controller.start(
      {
        ...prepared,
        gridWidth: 100.6,
        gridHeight: 20.6,
        leftLimit: 0,
        rightLimit: 0,
      },
      clocks,
    );
    expect([canvas.width, canvas.height]).toEqual(dimensions);
    expect(canvas.style.width).toBe("100.6px");
    expect(canvas.style.height).toBe("20.6px");
  });
  it("updates CSS dimensions when a pixel-ratio change retains backing dimensions", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    const prepared = controller.prepare();
    if (!prepared) throw new Error("The counter geometry was not prepared.");
    const clocks = new Map();
    controller.start(
      {
        ...prepared,
        gridWidth: 50,
        gridHeight: 20,
        leftLimit: 0,
        rightLimit: 0,
        atlas: { ...prepared.atlas, ratio: 2 },
      },
      clocks,
    );
    const canvas = controller.surface.canvas;
    const dimensions = [canvas.width, canvas.height];
    controller.start(
      {
        ...prepared,
        gridWidth: 100,
        gridHeight: 40,
        leftLimit: 0,
        rightLimit: 0,
        atlas: { ...prepared.atlas, ratio: 1 },
      },
      clocks,
    );
    expect([canvas.width, canvas.height]).toEqual(dimensions);
    expect(canvas.style.width).toBe("100px");
    expect(canvas.style.height).toBe("40px");
  });
  it("keeps red glyphs fully opaque and rejects subpixel edge slivers", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host, text } = mount();
    host.style.color = "rgb(255, 50, 50)";
    controller.update(settings);
    browser.show(host);
    text.textContent = "13.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    const alpha: number[] = [];
    browser.context.drawImage.mockImplementation(() => {
      alpha.push(browser.context.globalAlpha);
    });
    for (const progress of [0, 0.2, 0.5, 0.8, 0.99, 1]) {
      setProgress(browser.animations[0], progress);
      controller.draw();
    }
    setProgress(browser.animations[0], 0.225);
    expect(digitPositions(browser, controller, 6)).toHaveLength(1);
    setProgress(browser.animations[0], 0.3);
    expect(digitPositions(browser, controller, 6)).toHaveLength(2);
    expect(alpha.length).toBeGreaterThan(0);
    expect(alpha.every((value) => value === 1)).toBe(true);
    expect(
      [...atlases.values()].every((atlas) => atlas.ink === "rgb(255, 50, 50)"),
    ).toBe(true);
  });
  it("does not restart an unchanged digit when another place changes", async () => {
    const browser = createBrowserEnvironment();
    nativeColumns();
    const { controller, host, text } = mount();
    controller.update(settings);
    browser.show(host);
    text.textContent = "19.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[0], 0.5);
    const before = digitPositions(browser, controller, 6);
    text.textContent = "29.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[1], 0);
    expect(digitPositions(browser, controller, 6)).toEqual(before);
    expect(browser.animations[0].cancel).not.toHaveBeenCalled();
    setProgress(browser.animations[0], 0.6);
    expect(digitPositions(browser, controller, 6)).not.toEqual(before);
    controller.destroy();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
  it("preserves current position and ongoing travel when a moving digit retargets", async () => {
    const browser = createBrowserEnvironment();
    nativeColumns();
    const { controller, host, text } = mount();
    controller.update(settings);
    browser.show(host);
    text.textContent = "19.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[0], 0.5);
    const before = digitPositions(browser, controller, 6);
    text.textContent = "17.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[1], 0);
    expect(digitPositions(browser, controller, 6)).toEqual(before);
    setProgress(browser.animations[0], 0.6);
    expect(digitPositions(browser, controller, 6)).not.toEqual(before);
    browser.animations.forEach((animation) => {
      animation.playState = "finished";
    });
    const settled = digitPositions(browser, controller, 6);
    expect(settled).toHaveLength(0);
    expect(host.dataset.rollingReady).toBeUndefined();
    expect(text.textContent).toBe("17.00");
  });
  it("keeps the previous ink inside the canvas when a standalone counter shrinks", async () => {
    const browser = createBrowserEnvironment();
    nativeColumns();
    const { controller, host, text } = mount();
    let left = 0;
    let width = 80;
    Object.defineProperty(host, "clientWidth", { get: () => width });
    Object.defineProperty(host, "clientHeight", { get: () => 20 });
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ left, top: 0, width, height: 20 }) as DOMRect,
    });
    text.textContent = "$12345.00";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    browser.animations[0].playState = "finished";
    controller.draw();
    left = 20;
    width = 40;
    text.textContent = "τ5.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[1], 0);
    expect(controller.surface.leftBleed).toBeGreaterThanOrEqual(20);
    expect(controller.surface.canvas.width).toBeGreaterThan(width);
    expect(
      parseFloat(controller.surface.canvas.style.left),
    ).toBeLessThanOrEqual(-20);
    controller.destroy();
    expect(controller.surface.canvas.isConnected).toBe(false);
  });
  it("bounds backing pixels during and after a large horizontal move", async () => {
    const browser = createBrowserEnvironment();
    nativeColumns();
    const { controller, host, text } = mount();
    let left = 0;
    Object.defineProperty(host, "clientWidth", { get: () => 40 });
    Object.defineProperty(host, "clientHeight", { get: () => 20 });
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ left, top: 0, width: 40, height: 20 }) as DOMRect,
    });
    controller.update(settings);
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    left = 1000000;
    text.textContent = "13.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    expect(controller.surface.canvas.width).toBeLessThanOrEqual(
      window.innerWidth * window.devicePixelRatio,
    );
    browser.animations.forEach((animation) => {
      animation.playState = "finished";
    });
    controller.draw();
    expect(controller.surface.canvas.width).toBeLessThanOrEqual(
      window.innerWidth * window.devicePixelRatio,
    );
    left = 20;
    controller.refresh();
    await Promise.resolve();
    expect(controller.surface.canvas.width).toBeLessThanOrEqual(
      window.innerWidth * window.devicePixelRatio,
    );
  });
  it("releases finished contributions during prolonged rapid updates", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host, text } = mount();
    controller.update(settings);
    browser.show(host);
    for (let index = 0; index < 100; index += 1) {
      browser.animations.slice(0, -2).forEach((animation) => {
        animation.playState = "finished";
      });
      text.textContent = `${100 + index}.00`;
      controller.update({ ...settings, value: text.textContent });
      await Promise.resolve();
      expect(
        browser.animations.filter(
          (animation) => !animation.cancel.mock.calls.length,
        ).length,
      ).toBeLessThanOrEqual(4);
    }
    controller.destroy();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
  it("retains a shared old clock until its final interrupted user settles", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    document.body.appendChild(group);
    const first = mount(group);
    const second = mount(group);
    for (const counter of [first, second]) {
      counter.controller.update(settings);
      browser.show(counter.host);
      counter.text.textContent = "19.00";
      counter.controller.update({
        ...settings,
        value: counter.text.textContent,
      });
    }
    await Promise.resolve();
    expect(browser.animations).toHaveLength(1);
    first.text.textContent = "29.00";
    first.controller.update({ ...settings, value: first.text.textContent });
    await Promise.resolve();
    browser.animations[0].playState = "finished";
    second.controller.draw();
    expect(browser.animations[0].cancel).not.toHaveBeenCalled();
    first.controller.destroy();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
  it("interpolates currency columns from the previous absolute origin", async () => {
    const browser = createBrowserEnvironment();
    nativeColumns();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    document.body.appendChild(group);
    const { controller, host, text } = mount(group);
    let left = 100;
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ left, top: 0, width: 40, height: 20 }) as DOMRect,
    });
    text.textContent = "$12.00";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    browser.animations[0].playState = "finished";
    controller.draw();
    text.textContent = "τ2.00";
    left = 104;
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[1], 0);
    expect(digitPositions(browser, controller, 114)).toHaveLength(1);
    setProgress(browser.animations[1], 0.5);
    expect(digitPositions(browser, controller, 112)).toHaveLength(1);
    setProgress(browser.animations[1], 1);
    expect(digitPositions(browser, controller, 110)).toHaveLength(1);
  });
});
describe("canvas lifecycle", () => {
  it("measures proportional digits even when CSS requests tabular numbers", async () => {
    const browser = createBrowserEnvironment();
    const bounds = vi
      .spyOn(Range.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Range) {
        const text = this.startContainer.textContent ?? "";
        const advance = (value: string) =>
          [...value].reduce((sum, digit) => sum + (digit === "1" ? 4 : 8), 0);
        return {
          left: advance(text.slice(0, this.startOffset)),
          width: advance(text.slice(this.startOffset, this.endOffset)),
        } as DOMRect;
      });
    const { controller, host, text } = mount();
    host.style.fontVariantNumeric = "tabular-nums";
    text.textContent = "(32.91%)";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    const first = controller.prepare();
    expect(first?.characters.find((cell) => cell.key === "suffix")?.x).toBe(44);
    const cachedReads = bounds.mock.calls.length;
    controller.prepare();
    expect(bounds).toHaveBeenCalledTimes(cachedReads + 1);
    text.textContent = "(28.06%)";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    const second = controller.prepare();
    expect(second?.characters.find((cell) => cell.key === "suffix")?.x).toBe(
      48,
    );
    const updatedReads = bounds.mock.calls.length;
    text.textContent = "(28.60%)";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    controller.prepare();
    const frame = vi.mocked(requestAnimationFrame).mock.calls.slice(-1)[0]?.[0];
    frame?.(100);
    expect(bounds).toHaveBeenCalledTimes(updatedReads + 2);
  });

  it.each(["ltr", "rtl"] as const)(
    "preserves native origins for padded %s counters",
    async (direction) => {
      const browser = createBrowserEnvironment();
      vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Range) {
          const visual =
            direction === "rtl"
              ? [40, 8, 16, 24, 32, 0]
              : [8, 16, 24, 32, 40, 48];
          return {
            left: visual[this.startOffset],
            width: (this.endOffset - this.startOffset) * 8,
          } as DOMRect;
        },
      );
      const { controller, host, text } = mount();
      host.style.direction = direction;
      host.style.paddingLeft = "8px";
      text.textContent = "$12.34";
      controller.update({ ...settings, value: text.textContent });
      browser.show(host);
      const prepared = controller.prepare();
      expect(prepared?.characters.map((cell) => cell.x)).toEqual(
        direction === "rtl" ? [40, 8, 16, 24, 32, 0] : [8, 16, 24, 32, 40, 48],
      );
    },
  );

  it("refreshes virtual row transforms without moving the number identity", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    const row = document.createElement("div");
    group.appendChild(row);
    document.body.appendChild(group);
    const { controller, host } = mount(row);
    let top = 40;
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ left: 0, top, width: 40, height: 20 }) as DOMRect,
    });
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    top = 80;
    row.style.transform = "translateY(80px)";
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.animations).toHaveLength(2);
    expect(
      browser.animations.every(
        (animation) => !animation.cancel.mock.calls.length,
      ),
    ).toBe(true);
    browser.context.setTransform.mockClear();
    controller.draw();
    expect(browser.context.setTransform).toHaveBeenCalledWith(
      1,
      0,
      0,
      1,
      0,
      80,
    );
  });

  it.each(["before", "after"] as const)(
    "keeps value motion when layout refresh arrives %s the update",
    async (order) => {
      const browser = createBrowserEnvironment();
      const { controller, host, text } = mount();
      browser.show(host);
      controller.update(settings);
      await Promise.resolve();
      text.textContent = "13.00";
      if (order === "before") controller.refresh();
      controller.update({ ...settings, value: text.textContent });
      if (order === "after") controller.refresh();
      await Promise.resolve();
      expect(browser.animations).toHaveLength(3);
      expect(browser.durations).toEqual([350, 350, 350]);
      expect(browser.timings.map(({ delay }) => delay)).toEqual([0, 24, 0]);
      expect(host.dataset.rollingReady).toBe("");
    },
  );

  it("does not measure layout for opacity-only fades or canvas style writes", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    const row = document.createElement("div");
    row.style.opacity = "1";
    group.appendChild(row);
    document.body.appendChild(group);
    const { controller, host } = mount(row);
    browser.show(host);
    controller.update(settings);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const prepare = vi.spyOn(controller, "prepare");
    row.style.opacity = "0.5";
    const canvas = group.querySelector("canvas");
    if (!canvas) throw new Error("The shared canvas was not mounted.");
    canvas.style.left = "8px";
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rolls new zero columns and keeps unchanged zero columns still", async () => {
    const browser = createBrowserEnvironment();
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Range) {
        return {
          left: this.startOffset * 8,
          width: (this.endOffset - this.startOffset) * 8,
        } as DOMRect;
      },
    );
    const { controller, host, text } = mount();
    controller.update(settings);
    browser.show(host);
    text.textContent = "12.0000";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    vi.spyOn(browser.animations[0].effect, "getComputedTiming").mockReturnValue(
      { progress: 0.35 } as ComputedEffectTiming,
    );
    browser.context.drawImage.mockClear();
    controller.draw();
    const newZero = browser.context.drawImage.mock.calls.filter(
      ([, x]) => x === 38,
    );
    const oldZero = browser.context.drawImage.mock.calls.filter(
      ([, x]) => x === 22,
    );
    expect(newZero.some(([, , y]) => y !== 0)).toBe(true);
    expect(oldZero[0]?.[2]).toBe(0);
  });

  it("rolls added decimal places during a currency precision change", async () => {
    const browser = createBrowserEnvironment();
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Range) {
        return {
          left: this.startOffset * 8,
          width: (this.endOffset - this.startOffset) * 8,
        } as DOMRect;
      },
    );
    const { controller, host, text } = mount();
    text.textContent = "+τ0.22";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    await Promise.resolve();
    expect(browser.animations).toHaveLength(0);
    expect(host.dataset.rollingReady).toBeUndefined();
    text.textContent = "+τ0.0007706";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    const animation = browser.animations[0];
    expect(animation).toBeDefined();
    if (!animation)
      throw new Error("The precision change did not start motion.");
    vi.spyOn(animation.effect, "getComputedTiming").mockReturnValue({
      progress: 0.3,
    } as ComputedEffectTiming);
    browser.context.drawImage.mockClear();
    const frame = vi.mocked(requestAnimationFrame).mock.calls.slice(-1)[0]?.[0];
    frame?.(105);
    const tail = browser.context.drawImage.mock.calls.filter(
      ([, x]) => x === 78,
    );
    expect(tail.length).toBeGreaterThan(0);
    expect(tail.every(([, , y]) => y !== 0)).toBe(true);
  });

  it.each(["hide", "disable", "destroy"] as const)(
    "redraws the surviving neighbor when a counter is %s",
    async (action) => {
      const browser = createBrowserEnvironment();
      const group = document.createElement("div");
      group.dataset.digitloomGroup = "";
      document.body.appendChild(group);
      const first = mount(group);
      const second = mount(group);
      browser.show(first.host);
      browser.show(second.host);
      first.controller.update(settings);
      second.controller.update(settings);
      await Promise.resolve();
      const draw = vi.spyOn(second.controller, "draw");
      browser.context.clearRect.mockClear();
      if (action === "hide") browser.hide(first.host);
      if (action === "disable")
        first.controller.update({ ...settings, animated: false });
      if (action === "destroy") first.controller.destroy();
      await Promise.resolve();
      expect(draw).toHaveBeenCalledOnce();
      expect(browser.context.clearRect).toHaveBeenCalledOnce();
      expect(first.host.dataset.rollingReady).toBeUndefined();
      expect(second.host.dataset.rollingReady).toBe("");
    },
  );

  it("keeps settled neighbors native after a partial shared-surface update", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    document.body.appendChild(group);
    const amount = mount(group);
    const percent = mount(group);
    browser.show(amount.host);
    browser.show(percent.host);
    amount.controller.update(settings);
    percent.text.textContent = "(0.00%)";
    percent.controller.update({ ...settings, value: "(0.00%)", duration: 200 });
    await Promise.resolve();
    browser.animations.forEach((animation) => {
      animation.playState = "finished";
    });
    const frame = vi.mocked(requestAnimationFrame).mock.calls.slice(-1)[0]?.[0];
    frame?.(200);
    browser.context.clearRect.mockClear();
    browser.context.drawImage.mockClear();
    amount.text.textContent = "13.00";
    amount.controller.update({ ...settings, value: "13.00" });
    await Promise.resolve();
    expect(browser.context.clearRect).toHaveBeenCalledOnce();
    const lastClear =
      browser.context.clearRect.mock.invocationCallOrder.slice(-1)[0] ?? 0;
    expect(
      browser.context.drawImage.mock.invocationCallOrder.every(
        (order) => order > lastClear,
      ),
    ).toBe(true);
    const percentDraw = vi.spyOn(percent.controller, "draw");
    const nextFrame = vi
      .mocked(requestAnimationFrame)
      .mock.calls.slice(-1)[0]?.[0];
    nextFrame?.(250);
    expect(percentDraw).toHaveBeenCalledOnce();
    expect(percent.host.dataset.rollingReady).toBeUndefined();
    expect(amount.host.dataset.rollingReady).toBe("");
  });

  it("cancels motion when the reduced-motion preference changes", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    browser.setReducedMotion(true);
    expect(host.dataset.rollingReady).toBeUndefined();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
    controller.update({ ...settings, value: "99.99" });
    await Promise.resolve();
    expect(browser.animations).toHaveLength(2);
  });
  it("preserves the running clock when text width changes", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    browser.show(host);
    controller.refresh();
    await Promise.resolve();
    expect(browser.animations).toHaveLength(2);
    expect(
      browser.animations.every(
        (animation) => !animation.cancel.mock.calls.length,
      ),
    ).toBe(true);
    expect(host.dataset.rollingReady).toBe("");
  });
  it("keeps offscreen and disabled updates as native text", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    controller.update(settings);
    await Promise.resolve();
    expect(browser.animations).toHaveLength(0);
    browser.show(host);
    controller.update({ ...settings, value: "12.01" });
    await Promise.resolve();
    expect(browser.animations).toHaveLength(1);
    expect(host.dataset.rollingReady).toBe("");
    controller.update({ ...settings, animated: false, value: "12.02" });
    expect(host.dataset.rollingReady).toBeUndefined();
    expect(browser.animations[0].cancel).toHaveBeenCalledOnce();
  });
  it("shares a surface and clock, then removes them after the last counter", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    document.body.appendChild(group);
    const first = mount(group);
    const second = mount(group);
    browser.show(first.host);
    browser.show(second.host);
    first.controller.update(settings);
    second.controller.update(settings);
    await Promise.resolve();
    expect(group.querySelectorAll("canvas")).toHaveLength(1);
    expect(browser.animations).toHaveLength(2);
    first.controller.destroy();
    expect(group.querySelectorAll("canvas")).toHaveLength(1);
    expect(
      browser.animations.every(
        (animation) => !animation.cancel.mock.calls.length,
      ),
    ).toBe(true);
    second.controller.destroy();
    second.controller.destroy();
    expect(group.querySelectorAll("canvas")).toHaveLength(0);
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
    expect(browser.disconnect).toHaveBeenCalledOnce();
  });
  it("cancels pending work when a counter unmounts before the batch", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    controller.destroy();
    await Promise.resolve();
    expect(browser.animations).toHaveLength(0);
    expect(document.querySelector("canvas")).toBeNull();
  });
  it("settles to exact native text when a counter leaves the viewport", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host, text } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    browser.hide(host);
    expect(host.dataset.rollingReady).toBeUndefined();
    expect(text.textContent).toBe(settings.value);
    expect(browser.animations[0].cancel).toHaveBeenCalledOnce();
  });
  it("retains the old roll until an interrupted motion finishes", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    controller.update({ ...settings, value: "99.99" });
    await Promise.resolve();
    expect(browser.animations).toHaveLength(4);
    expect(browser.animations[0].cancel).not.toHaveBeenCalled();
    browser.animations.forEach((animation) => {
      animation.playState = "finished";
    });
    controller.draw();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length === 1,
      ),
    ).toBe(true);
    expect(host.dataset.rollingReady).toBeUndefined();
  });
});
