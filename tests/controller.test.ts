// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { atlases, glyph } from "../src/core/glyphAtlas.js";
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
  const baseline = document.createElement("span");
  baseline.setAttribute("aria-hidden", "true");
  text.appendChild(baseline);
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
  it("centers proportional canvas glyphs in tabular text columns", async () => {
    const browser = createBrowserEnvironment();
    vi.spyOn(
      browser.context as unknown as CanvasRenderingContext2D,
      "measureText",
    ).mockImplementation(
      (text: string) =>
        ({
          width: text === "1" ? 4 : 8,
          actualBoundingBoxRight: text === "1" ? 4 : 8,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 2,
          fontBoundingBoxAscent: 10,
          fontBoundingBoxDescent: 2,
        }) as TextMetrics,
    );
    const { controller, host } = mount();
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Range) {
        return {
          left: this.startOffset * 8,
          width: (this.endOffset - this.startOffset) * 8,
        } as DOMRect;
      },
    );
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    const prepared = controller.prepare();
    if (!prepared) throw new Error("The counter geometry was not prepared.");
    expect(prepared.cells[0]?.width).toBe(8);
    const one = glyph(prepared.atlas, "1");
    expect(one.advance).toBe(4);
    browser.context.drawImage.mockClear();
    controller.draw();
    const oneDraw = browser.context.drawImage.mock.calls.find(
      ([canvas]) => canvas === one.canvas,
    );
    expect(oneDraw?.[1]).toBe(0);
  });

  it("uses the native baseline and reuses its font measurement", async () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        return {
          left: 0,
          top:
            this.tagName === "SPAN" &&
            this.getAttribute("aria-hidden") === "true"
              ? 112.75
              : 100,
          width: 40,
          height: 20,
        } as DOMRect;
      },
    );
    browser.show(current.host);
    current.controller.update(settings);
    await Promise.resolve();
    const prepared = current.controller.prepare();
    expect(prepared?.atlas.baseline).toBe(12.75);
    expect(current.text.childNodes).toHaveLength(2);
    const create = vi.spyOn(document, "createElement");
    expect(current.controller.prepare()?.atlas).toBe(prepared?.atlas);
    expect(create).not.toHaveBeenCalled();
  });
  it("leaves an empty value as native text without measuring the marker as text", () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    current.text.childNodes[0].textContent = "";
    browser.show(current.host);
    current.controller.update({ ...settings, value: "" });
    expect(current.controller.prepare()).toBeNull();
    expect(current.text.textContent).toBe("");
  });

  it("settles motion when the number becomes non-renderable", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host, text } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    text.childNodes[0].textContent = "13.00";
    controller.update({ ...settings, value: "13.00" });
    await Promise.resolve();
    expect(host.dataset.rollingReady).toBeDefined();
    vi.spyOn(text, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    } as DOMRect);
    controller.refresh();
    await Promise.resolve();
    expect(host.dataset.rollingReady).toBeUndefined();
    expect(
      browser.animations.every(
        (animation) => animation.cancel.mock.calls.length,
      ),
    ).toBe(true);
    browser.context.drawImage.mockClear();
    controller.draw();
    expect(browser.context.drawImage).not.toHaveBeenCalled();
  });

  it("clips canvas painting to overflow ancestors between the number and group", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    const row = document.createElement("div");
    row.style.overflow = "hidden";
    group.appendChild(row);
    document.body.appendChild(group);
    const { controller, host } = mount(row);
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    expect(controller.prepare()?.clip).not.toBeNull();
    browser.context.rect.mockClear();
    controller.draw();
    expect(browser.context.clip).toHaveBeenCalled();
    expect(browser.context.rect).toHaveBeenCalledTimes(2);
  });

  it("applies child opacity to its shared-surface drawing", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    const row = document.createElement("div");
    row.style.opacity = "0.5";
    group.appendChild(row);
    document.body.appendChild(group);
    const { controller, host } = mount(row);
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    controller.draw();
    expect(browser.context.globalAlpha).toBe(0.5);
  });

  it("clears an active roll for empty text and resumes from a later number", async () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    browser.show(current.host);
    current.controller.update(settings);
    await Promise.resolve();
    current.text.childNodes[0].textContent = "19.00";
    current.controller.update({ ...settings, value: "19.00" });
    await Promise.resolve();
    expect(current.host.dataset.rollingReady).toBeDefined();
    const running = browser.animations.filter(
      (animation) => animation.cancel.mock.calls.length === 0,
    );
    current.text.childNodes[0].textContent = "";
    current.controller.update({ ...settings, value: "" });
    await Promise.resolve();
    expect(current.host.dataset.rollingReady).toBeUndefined();
    running.forEach((animation) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
    browser.context.drawImage.mockClear();
    current.controller.draw();
    expect(browser.context.drawImage).not.toHaveBeenCalled();
    current.text.childNodes[0].textContent = "42.00";
    current.controller.update({ ...settings, value: "42.00" });
    await Promise.resolve();
    expect(current.host.dataset.rollingReady).toBeDefined();
    expect(browser.context.drawImage).toHaveBeenCalled();
    expect(current.text.textContent).toBe("42.00");
  });

  it("rebuilds font metrics without inserting or removing live text nodes", () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    browser.show(current.host);
    current.controller.update(settings);
    const observer = new MutationObserver(() => {});
    observer.observe(current.host, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    for (const value of ["12.00", "τ0.0007706", "$1,234.56"]) {
      current.text.childNodes[0].textContent = value;
      current.controller.update({ ...settings, value });
      observer.takeRecords();
      atlases.clear();
      const prepared = current.controller.prepare();
      expect(prepared?.atlas.baseline).toBe(14);
      expect(observer.takeRecords()).toEqual([]);
    }
    observer.disconnect();
  });

  it("keeps cached metrics and avoids refresh on empty font completions", async () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    browser.show(current.host);
    current.controller.update(settings);
    await Promise.resolve();
    const atlas = current.controller.prepare()?.atlas;
    const create = vi.spyOn(document, "createElement");
    const queue = vi.spyOn(window, "queueMicrotask");
    for (let index = 0; index < 82; index += 1) browser.finishFonts();
    expect(current.controller.prepare()?.atlas).toBe(atlas);
    expect(create).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
  });

  it("refreshes shared counters when a font face finishes loading", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    document.body.appendChild(group);
    const first = mount(group);
    const second = mount(group);
    for (const current of [first, second]) {
      browser.show(current.host);
      current.controller.update(settings);
    }
    await Promise.resolve();
    const atlas = first.controller.prepare()?.atlas;
    const prepareFirst = vi.spyOn(first.controller, "prepare");
    const prepareSecond = vi.spyOn(second.controller, "prepare");
    browser.finishFonts([{ family: "Arial", status: "loaded" } as FontFace]);
    expect(atlases.size).toBe(0);
    await Promise.resolve();
    expect(prepareFirst).toHaveBeenCalledOnce();
    expect(prepareSecond).toHaveBeenCalledOnce();
    expect(first.controller.prepare()?.atlas).not.toBe(atlas);
  });

  it("ignores repeated loaded faces while retaining later font arrivals", async () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    browser.show(current.host);
    current.controller.update(settings);
    await Promise.resolve();
    const face = { family: "Arial", status: "loaded" } as FontFace;
    browser.finishFonts([face, face]);
    await Promise.resolve();
    const atlas = current.controller.prepare()?.atlas;
    const create = vi.spyOn(document, "createElement");
    const queue = vi.spyOn(window, "queueMicrotask");
    for (let index = 0; index < 50; index += 1)
      browser.finishFonts(Array(140).fill(face));
    expect(current.controller.prepare()?.atlas).toBe(atlas);
    expect(create).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
    browser.finishFonts([
      face,
      { family: "Inter", status: "loaded" } as FontFace,
    ]);
    await Promise.resolve();
    expect(current.controller.prepare()?.atlas).not.toBe(atlas);
    expect(queue).toHaveBeenCalledOnce();
  });

  it("removes the font listener when the last counter unmounts", async () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    browser.show(current.host);
    current.controller.update(settings);
    await Promise.resolve();
    const atlas = current.controller.prepare()?.atlas;
    current.controller.destroy();
    browser.finishFonts([{ family: "Arial", status: "loaded" } as FontFace]);
    expect([...atlases.values()]).toContain(atlas);
    expect(document.fonts.removeEventListener).toHaveBeenCalledWith(
      "loadingdone",
      expect.any(Function),
    );
  });

  it("reuses baseline measurements across fractional position noise", async () => {
    const browser = createBrowserEnvironment();
    const current = mount();
    let height = 22.000001907348633;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        return {
          left: 0,
          top:
            this.tagName === "SPAN" &&
            this.getAttribute("aria-hidden") === "true"
              ? 116
              : 100,
          width: 40,
          height,
        } as DOMRect;
      },
    );
    browser.show(current.host);
    current.controller.update(settings);
    await Promise.resolve();
    const initial = current.controller.prepare();
    const create = vi.spyOn(document, "createElement");
    for (const next of [
      22.000001907348633, 21.999998092651367, 21.999996185302734,
      22.000003814697266, 21.99999237060547, 22.00000762939453,
    ]) {
      height = next;
      expect(current.controller.prepare()?.atlas).toBe(initial?.atlas);
    }
    expect(create).not.toHaveBeenCalled();
    expect(initial?.atlas.lineHeight).toBe(22.000001907348633);
    height = 23.125;
    const changed = current.controller.prepare();
    expect(changed?.atlas).not.toBe(initial?.atlas);
    expect(changed?.atlas.lineHeight).toBe(23.125);
    expect(create).not.toHaveBeenCalled();
    expect(current.text.childNodes).toHaveLength(2);
  });

  it("shares text baselines without sharing host padding offsets", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    document.body.appendChild(group);
    const first = mount(group);
    const second = mount(group);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const textTop =
          this === first.text ? 10 : this === second.text ? 20 : 0;
        const probeTop = this.parentElement === first.text ? 23 : 33;
        return {
          left: 0,
          top:
            this.tagName === "SPAN" &&
            this.getAttribute("aria-hidden") === "true"
              ? probeTop
              : textTop,
          width: 40,
          height: this === first.host || this === second.host ? 40 : 20,
        } as DOMRect;
      },
    );
    browser.show(first.host);
    browser.show(second.host);
    first.controller.update(settings);
    second.controller.update(settings);
    await Promise.resolve();
    const a = first.controller.prepare();
    const b = second.controller.prepare();
    expect(a?.atlas).toBe(b?.atlas);
    expect(a?.atlas.baseline).toBe(13);
    expect([a?.y, b?.y]).toEqual([10, 20]);
    expect(first.text.childNodes).toHaveLength(2);
    expect(second.text.childNodes).toHaveLength(2);
  });
  it.each([1, 1.25, 1.5, 2, 3])(
    "preserves native origins and restores text before the clock ends at pixel ratio %s",
    async (ratio) => {
      const browser = createBrowserEnvironment();
      const current = mount();
      browser.show(current.host);
      current.controller.update(settings);
      await Promise.resolve();
      const prepared = current.controller.prepare();
      if (!prepared) throw new Error("Counter geometry is unavailable.");
      const characters = prepared.cells.map((cell, index) => ({
        ...cell,
        x: index * 8.13,
      }));
      current.controller.start(
        {
          ...prepared,
          cells: characters,
          x: 0.31,
          y: 0.15,
          atlas: { ...prepared.atlas, ratio, lineHeight: 20.3 },
        },
        new Map(),
      );
      current.controller.surface.leftBleed = 0.23;
      browser.animations.forEach((animation) => setProgress(animation, 0.5));
      browser.context.drawImage.mockClear();
      current.controller.draw();
      const transform = browser.context.setTransform.mock.calls.slice(-1)[0];
      if (!transform) throw new Error("The canvas transform is unavailable.");
      expect(transform[5]).toBeCloseTo(0.15 * ratio, 8);
      const draws = browser.context.drawImage.mock.calls;
      expect(draws.length).toBeGreaterThan(0);
      draws.forEach(([, x]) => {
        expect(
          characters.some(
            (cell) => Math.abs(Number(x) - (0.31 + cell.x - 2)) < 1e-8,
          ),
        ).toBe(true);
      });
      browser.animations.forEach((animation) =>
        setProgress(animation, 0.99999),
      );
      browser.context.drawImage.mockClear();
      current.controller.draw();
      expect(current.host.dataset.rollingReady).toBeUndefined();
      expect(browser.context.drawImage).not.toHaveBeenCalled();
      expect(
        browser.animations.every(
          (animation) => animation.playState !== "finished",
        ),
      ).toBe(true);
      browser.animations.forEach((animation) => setProgress(animation, 0.9));
      current.controller.draw();
      expect(current.host.dataset.rollingReady).toBe("");
      expect(browser.context.drawImage).toHaveBeenCalled();
      browser.animations.forEach((animation) => {
        animation.playState = "finished";
      });
      current.controller.draw();
      expect(current.host.dataset.rollingReady).toBeUndefined();
    },
  );
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
  it("keeps fractional surfaces aligned with their backing pixels", async () => {
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
    expect(canvas.style.width).toBe("101px");
    expect(canvas.style.height).toBe("21px");
  });
  it.each([1, 1.25, 1.5, 2, 3])(
    "preserves native bitmap scale at pixel ratio %s",
    async (ratio) => {
      const browser = createBrowserEnvironment();
      const current = mount();
      browser.show(current.host);
      current.controller.update(settings);
      await Promise.resolve();
      const prepared = current.controller.prepare();
      if (!prepared) throw new Error("The counter geometry was not prepared.");
      current.controller.start(
        {
          ...prepared,
          gridWidth: 100.21,
          gridHeight: 20.61,
          leftLimit: 0,
          rightLimit: 0,
          atlas: { ...prepared.atlas, ratio },
        },
        new Map(),
      );
      const canvas = current.controller.surface.canvas;
      expect(parseFloat(canvas.style.width) * ratio).toBeCloseTo(
        canvas.width,
        8,
      );
      expect(parseFloat(canvas.style.height) * ratio).toBeCloseTo(
        canvas.height,
        8,
      );
    },
  );
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
  it("rounds reel travel while retaining the native row origin", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host } = mount();
    browser.show(host);
    controller.update(settings);
    await Promise.resolve();
    const prepared = controller.prepare();
    if (!prepared) throw new Error("The counter geometry was not prepared.");
    controller.start(
      {
        ...prepared,
        y: 0.15,
        atlas: { ...prepared.atlas, lineHeight: 20.3, ratio: 2 },
      },
      new Map(),
    );
    browser.context.drawImage.mockClear();
    browser.context.setTransform.mockClear();
    controller.draw();
    expect(browser.context.drawImage.mock.calls.length).toBeGreaterThan(0);
    expect(
      browser.context.drawImage.mock.calls.every(([, , y]) =>
        Number.isInteger(Number(y) * 2),
      ),
    ).toBe(true);
    expect(
      browser.context.setTransform.mock.calls.every(
        ([, , , , , y]) => y === 0.3,
      ),
    ).toBe(true);
  });
  it("keeps red glyphs fully opaque and rejects subpixel edge slivers", async () => {
    const browser = createBrowserEnvironment();
    const { controller, host, text } = mount();
    host.style.color = "rgb(255, 50, 50)";
    controller.update(settings);
    browser.show(host);
    text.childNodes[0].textContent = "13.00";
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
    text.childNodes[0].textContent = "19.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[0], 0.5);
    const before = digitPositions(browser, controller, 6);
    text.childNodes[0].textContent = "29.00";
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
    text.childNodes[0].textContent = "19.00";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[0], 0.5);
    const before = digitPositions(browser, controller, 6);
    text.childNodes[0].textContent = "17.00";
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
    text.childNodes[0].textContent = "$12345.00";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    browser.animations[0].playState = "finished";
    controller.draw();
    left = 20;
    width = 40;
    text.childNodes[0].textContent = "τ5.00";
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
    text.childNodes[0].textContent = "13.00";
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
      text.childNodes[0].textContent = `${100 + index}.00`;
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
      counter.text.childNodes[0].textContent = "19.00";
      counter.controller.update({
        ...settings,
        value: counter.text.textContent,
      });
    }
    await Promise.resolve();
    expect(browser.animations).toHaveLength(1);
    first.text.childNodes[0].textContent = "29.00";
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
    text.childNodes[0].textContent = "$12.00";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    browser.animations[0].playState = "finished";
    controller.draw();
    text.childNodes[0].textContent = "τ2.00";
    left = 104;
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    setProgress(browser.animations[1], 0);
    expect(digitPositions(browser, controller, 114)).toHaveLength(1);
    setProgress(browser.animations[1], 0.5);
    expect(digitPositions(browser, controller, 112)).toHaveLength(1);
    setProgress(browser.animations[1], 1);
    expect(digitPositions(browser, controller, 110)).toHaveLength(0);
    expect(host.dataset.rollingReady).toBeUndefined();
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
    text.childNodes[0].textContent = "(32.91%)";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    const first = controller.prepare();
    expect(first?.cells.find((cell) => cell.place === "suffix")?.x).toBe(44);
    const cachedReads = bounds.mock.calls.length;
    controller.prepare();
    expect(bounds).toHaveBeenCalledTimes(cachedReads + 1);
    text.childNodes[0].textContent = "(28.06%)";
    controller.update({ ...settings, value: text.textContent });
    await Promise.resolve();
    const second = controller.prepare();
    expect(second?.cells.find((cell) => cell.place === "suffix")?.x).toBe(48);
    const updatedReads = bounds.mock.calls.length;
    text.childNodes[0].textContent = "(28.60%)";
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
      text.childNodes[0].textContent = "$12.34";
      controller.update({ ...settings, value: text.textContent });
      browser.show(host);
      const prepared = controller.prepare();
      expect(prepared?.cells.map((cell) => cell.x)).toEqual(
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
    const { controller, host, text } = mount(row);
    let top = 40;
    for (const element of [host, text]) {
      Object.defineProperty(element, "getBoundingClientRect", {
        value: () => ({ left: 0, top, width: 40, height: 20 }) as DOMRect,
      });
    }
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
      text.childNodes[0].textContent = "13.00";
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

  it("refreshes opacity changes and ignores canvas style writes", async () => {
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
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("refreshes active flex siblings when a number changes its width", async () => {
    const browser = createBrowserEnvironment();
    const group = document.createElement("div");
    group.dataset.digitloomGroup = "";
    const row = document.createElement("div");
    row.style.display = "flex";
    group.appendChild(row);
    document.body.appendChild(group);
    const first = mount(row);
    const second = mount(row);
    for (const current of [first, second]) {
      browser.show(current.host);
      current.controller.update(settings);
    }
    await Promise.resolve();
    const prepareSecond = vi.spyOn(second.controller, "prepare");
    first.text.childNodes[0].textContent = "13.00";
    vi.spyOn(first.text, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 50,
      height: 20,
    } as DOMRect);
    first.controller.update({ ...settings, value: "13.00" });
    await Promise.resolve();
    await Promise.resolve();
    expect(prepareSecond).toHaveBeenCalled();
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
    text.childNodes[0].textContent = "12.0000";
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
    text.childNodes[0].textContent = "+τ0.22";
    controller.update({ ...settings, value: text.textContent });
    browser.show(host);
    await Promise.resolve();
    expect(browser.animations).toHaveLength(0);
    expect(host.dataset.rollingReady).toBeUndefined();
    text.childNodes[0].textContent = "+τ0.0007706";
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
    percent.text.childNodes[0].textContent = "(0.00%)";
    percent.controller.update({ ...settings, value: "(0.00%)", duration: 200 });
    await Promise.resolve();
    browser.animations.forEach((animation) => {
      animation.playState = "finished";
    });
    const frame = vi.mocked(requestAnimationFrame).mock.calls.slice(-1)[0]?.[0];
    frame?.(200);
    browser.context.clearRect.mockClear();
    browser.context.drawImage.mockClear();
    amount.text.childNodes[0].textContent = "13.00";
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
