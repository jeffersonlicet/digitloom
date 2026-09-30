// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
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
