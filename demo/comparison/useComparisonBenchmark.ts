/** @fileoverview Coordinates repeatable browser samples and cancellation. */
import { useEffect, useRef, useState } from "react";
import sizes from "../library-sizes.json";
import seed from "../scaling-baseline.json";
import { flushSync } from "react-dom";
import { ENGINES, type Engine } from "./renderers";
import {
  measureRenderer,
  TIMED_SAMPLE_LIMIT_MS,
  type BenchmarkSettings,
  type RendererSample,
} from "./measure";

export interface ComparisonRun {
  capturedAt: string;
  numberFlowGrouped: boolean;
  timedSampleLimitMs: number | null;
  userAgent: string;
  settings: BenchmarkSettings;
  samples: RendererSample[];
  complete: boolean;
  warmupUpdates?: number;
  viewport: { width: number; height: number; pixelRatio: number };
  versions: Record<string, string>;
}

export function useComparisonBenchmark() {
  const stage = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Engine>("static");
  const [round, setRound] = useState(1);
  const [result, setResult] = useState<ComparisonRun | null>(null);
  const [message, setMessage] = useState("");
  const [runs, setRuns] = useState<ComparisonRun[]>([]);
  const [activeCount, setActiveCount] = useState(1);
  const scope = useRef("");
  useEffect(() => () => controller.current?.abort(), []);

  async function run(
    settings: BenchmarkSettings,
    counts: readonly number[],
    engines: readonly Engine[] = ENGINES,
  ) {
    const container = stage.current;
    if (!container || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    const key = JSON.stringify({
      ...settings,
      count: undefined,
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
    });
    if (scope.current !== key) {
      setRuns([]);
      scope.current = key;
    }
    let captured: ComparisonRun | null = null;
    const save = (capture: ComparisonRun) => {
      const copy = { ...capture, samples: [...capture.samples] };
      setResult(copy);
      setRuns((previous) =>
        [
          ...previous.filter(
            (run) =>
              run.settings.count !== copy.settings.count ||
              run.settings.layout !== copy.settings.layout,
          ),
          copy,
        ].sort((left, right) => left.settings.count - right.settings.count),
      );
    };
    const hidden = () => {
      if (document.visibilityState !== "visible") abort.abort();
    };
    document.addEventListener("visibilitychange", hidden);
    flushSync(() => {
      setBusy(true);
      setResult(null);
      setMessage("");
    });
    try {
      for (const count of counts) {
        captured = {
          capturedAt: new Date().toISOString(),
          numberFlowGrouped: true,
          warmupUpdates: 1,
          timedSampleLimitMs: TIMED_SAMPLE_LIMIT_MS,
          userAgent: navigator.userAgent,
          settings: { ...settings, count },
          samples: [],
          complete: false,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: window.devicePixelRatio,
          },
          versions: Object.fromEntries(
            Object.entries(sizes.libraries).map(([name, library]) => [
              name,
              library.version,
            ]),
          ),
        };
        for (let round = 1; round <= 2; round += 1) {
          const order = round === 1 ? [...engines] : [...engines].reverse();
          for (const engine of order) {
            flushSync(() => {
              setActive(engine);
              setRound(round);
              setActiveCount(count);
            });
            captured.samples.push(
              await measureRenderer(
                container,
                engine,
                round,
                captured.settings,
                abort.signal,
              ),
            );
            save(captured);
          }
        }
        captured.complete = captured.samples.every(
          (sample) => sample.status === "complete",
        );
        save(captured);
      }
    } catch (error) {
      if (captured) save(captured);
      setMessage(
        abort.signal.aborted
          ? "Stopped. Keep this page visible for a complete run."
          : error instanceof Error
            ? error.message
            : "The browser comparison failed.",
      );
    } finally {
      document.removeEventListener("visibilitychange", hidden);
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const activeRuns = runs.filter(
    (run) => (run.settings.layout ?? "grid") === layout,
  );
  const includedRuns = (seed.runs as ComparisonRun[]).filter(
    (run) => (run.settings.layout ?? "grid") === layout,
  );
  return {
    stage,
    layout,
    setLayout,
    runs: activeRuns.length ? activeRuns : includedRuns,
    includedCapture: activeRuns.length === 0 && includedRuns.length > 0,
    activeCount,
    busy,
    active,
    round,
    result,
    message,
    run,
    stop: () => controller.current?.abort(),
  };
}
export type ComparisonBenchmark = ReturnType<typeof useComparisonBenchmark>;
