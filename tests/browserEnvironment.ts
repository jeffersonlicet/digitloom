/** @fileoverview Provides controllable browser boundaries for canvas lifecycle checks. */
import { vi } from "vitest";
export function createBrowserEnvironment() {
  let notify: IntersectionObserverCallback;
  const disconnect = vi.fn();
  const unobserve = vi.fn();
  const removeMediaListener = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe() {}
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const motionPreference = {
    matches: false,
    addEventListener: vi.fn((_event: string, _listener: () => void) => {}),
    removeEventListener: removeMediaListener,
  };
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("prefers-reduced-motion")
      ? motionPreference
      : {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
  );
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  const context = {
    font: "",
    fontKerning: "",
    letterSpacing: "",
    fillStyle: "",
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    measureText: () => ({
      width: 8,
      actualBoundingBoxRight: 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
    }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 40,
    height: 20,
    right: 40,
    bottom: 20,
    toJSON() {},
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, width: 8 }),
  });
  const animations: {
    cancel: ReturnType<typeof vi.fn>;
    playState: string;
    effect: KeyframeEffect;
    currentTime: number;
  }[] = [];
  const durations: number[] = [];
  vi.stubGlobal(
    "KeyframeEffect",
    class {
      constructor(
        _target: unknown,
        _frames: unknown,
        timing: KeyframeEffectOptions,
      ) {
        durations.push(Number(timing.duration));
      }
      getComputedTiming() {
        return { progress: 0.5 };
      }
    },
  );
  vi.stubGlobal(
    "Animation",
    class {
      cancel = vi.fn();
      playState = "running";
      currentTime = 0;
      constructor(public effect: KeyframeEffect) {
        animations.push(this);
      }
      play() {}
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return {
    animations,
    durations,
    setReducedMotion(reduced: boolean) {
      motionPreference.matches = reduced;
      motionPreference.addEventListener.mock.calls.forEach(([, listener]) =>
        listener(),
      );
    },
    context,
    disconnect,
    unobserve,
    removeMediaListener,
    show(element: Element) {
      notify(
        [
          {
            target: element,
            isIntersecting: true,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    },
    hide(element: Element) {
      notify(
        [
          {
            target: element,
            isIntersecting: false,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    },
  };
}
