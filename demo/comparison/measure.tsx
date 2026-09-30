/** @fileoverview Samples one renderer at a time without concurrent demo animations. */
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { CounterGrid, type CounterSettings, type Engine } from "./renderers";

import type { FontFace } from "../usePlayground";

export const TIMED_SAMPLE_LIMIT_MS = 10_000;

const VALUES = [1234.56, 1987.54, 999.99, 1000.01, -99.99, -100.01, 0, 9.99];

export interface BenchmarkSettings extends CounterSettings {
  font: FontFace;
  count: number;
  interval: number;
  layout?: "grid" | "list";
}
export interface RendererSample {
  engine: Engine;
  round: number;
  status: "complete" | "budget-limited";
  visibility: {
    method: "intersection" | "viewport-bounds";
    count: number;
    afterScroll?: number;
  };
  commitsMs: number[];
  frameGapsMs: number[];
  longTasksMs: number[] | null;
}

export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

/** Keeps cancellation and timer cleanup outside the measured update. */
function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Counts positive intersections through ancestor clips before timing starts. */
function countVisibleCounters(
  container: HTMLElement,
  signal: AbortSignal,
): Promise<number> {
  const counters = [
    ...container.querySelectorAll<HTMLElement>("[data-counter]"),
  ];
  if (!counters.length) return Promise.resolve(0);
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const intersections = new Map<Element, boolean>();
    const cleanup = () => {
      observer.disconnect();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) =>
        intersections.set(
          entry.target,
          entry.isIntersecting &&
            entry.intersectionRect.width > 0 &&
            entry.intersectionRect.height > 0,
        ),
      );
      if (intersections.size !== counters.length) return;
      cleanup();
      resolve([...intersections.values()].filter(Boolean).length);
    });
    signal.addEventListener("abort", abort, { once: true });
    counters.forEach((counter) => observer.observe(counter));
  });
}

/** Measures update calls and main-thread frame scheduling, not GPU presentation or paint. */
export async function measureRenderer(
  container: HTMLElement,
  engine: Engine,
  round: number,
  settings: BenchmarkSettings,
  signal: AbortSignal,
): Promise<RendererSample> {
  const root = createRoot(container);
  const commitsMs: number[] = [];
  const frameGapsMs: number[] = [];
  const longTasksMs: number[] | null =
    PerformanceObserver.supportedEntryTypes.includes("longtask") ? [] : null;
  let status: RendererSample["status"] = "complete";
  let started = Infinity;
  let ended = Infinity;
  let frame = 0;
  let previous: number | undefined;
  const collect = (entries: PerformanceEntry[]) =>
    entries.forEach((entry) => {
      if (entry.startTime >= started && entry.startTime < ended)
        longTasksMs?.push(entry.duration);
    });
  const observer =
    longTasksMs === null
      ? null
      : new PerformanceObserver((list) => collect(list.getEntries()));
  observer?.observe({ type: "longtask" });
  const sampleFrame = (timestamp: number) => {
    if (previous !== undefined) frameGapsMs.push(timestamp - previous);
    previous = timestamp;
    frame = requestAnimationFrame(sampleFrame);
  };
  const render = (value: number) =>
    flushSync(() =>
      root.render(<CounterGrid engine={engine} value={value} {...settings} />),
    );
  try {
    render(VALUES[0]);
    container.scrollIntoView({ block: "center", behavior: "auto" });
    await wait(150, signal);
    for (let index = 0; index < 1; index += 1) {
      render(VALUES[index + 1]);
      await wait(settings.interval, signal);
    }
    const visibleCounters = await countVisibleCounters(container, signal);
    started = performance.now();
    frame = requestAnimationFrame(sampleFrame);
    await wait(30, signal);
    let afterScroll: number | undefined;
    for (const [index, value] of VALUES.entries()) {
      signal.throwIfAborted();
      if (settings.layout === "list" && index === 4) {
        const grid = container.querySelector<HTMLElement>(".counter-grid");
        if (grid) grid.scrollTop = grid.scrollHeight / 2;
        afterScroll = await countVisibleCounters(container, signal);
      }
      const before = performance.now();
      render(value);
      commitsMs.push(performance.now() - before);
      await wait(settings.interval, signal);
      // Synchronous library work cannot be interrupted. Bound repetitions after it returns.
      if (
        performance.now() - started >= TIMED_SAMPLE_LIMIT_MS &&
        commitsMs.length < VALUES.length
      ) {
        status = "budget-limited";
        break;
      }
    }
    await wait(settings.duration + 50, signal);
    ended = performance.now();
    collect(observer?.takeRecords() ?? []);
    return {
      engine,
      round,
      status,
      visibility: {
        method: "intersection",
        count: visibleCounters,
        afterScroll,
      },
      commitsMs,
      frameGapsMs,
      longTasksMs,
    };
  } finally {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    container
      .getAnimations({ subtree: true })
      .forEach((animation) => animation.cancel());
    root.unmount();
  }
}
