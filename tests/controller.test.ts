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
    const clock = browser.animations[0];
    top = 80;
    row.style.transform = "translateY(80px)";
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.animations).toHaveLength(1);
    expect(clock.cancel).not.toHaveBeenCalled();
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
      expect(browser.animations).toHaveLength(2);
      expect(browser.durations).toEqual([350, 350]);
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
    expect(tail).toHaveLength(2);
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

  it("redraws settled neighbors after a partial shared-surface update", async () => {
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
  });

  it("cancels motion when the reduced-motion preference changes", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    browser.setReducedMotion(true);
    expect(host.dataset.rollingReady).toBeUndefined();
    expect(browser.animations[0].cancel).toHaveBeenCalledOnce();
    controller.update({ ...settings, value: "99.99" });
    await Promise.resolve();
    expect(browser.animations).toHaveLength(1);
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
    expect(browser.animations).toHaveLength(1);
    expect(browser.animations[0].cancel).not.toHaveBeenCalled();
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
    expect(browser.animations).toHaveLength(1);
    first.controller.destroy();
    expect(group.querySelectorAll("canvas")).toHaveLength(1);
    expect(browser.animations[0].cancel).not.toHaveBeenCalled();
    second.controller.destroy();
    second.controller.destroy();
    expect(group.querySelectorAll("canvas")).toHaveLength(0);
    expect(browser.animations[0].cancel).toHaveBeenCalledOnce();
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
  it("releases the old clock when an update interrupts motion", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    controller.update({ ...settings, value: "99.99" });
    await Promise.resolve();
    expect(browser.animations).toHaveLength(2);
    expect(browser.animations[0].cancel).toHaveBeenCalledOnce();
    expect(host.dataset.rollingReady).toBe("");
  });
});
