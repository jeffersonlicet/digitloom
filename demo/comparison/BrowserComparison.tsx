/** @fileoverview Coordinates isolated measurements and presents the full-width scaling chart. */
import React from "react";
import type { PlaygroundModel } from "../usePlayground";
import { useMotionAllowed } from "./useMotionAllowed";
import { ENGINE_NAMES, type Engine } from "./renderers";
import { ScalingChart } from "./ScalingChart";
import type { ComparisonBenchmark } from "./useComparisonBenchmark";

export function BrowserComparison({
  model,
  benchmark,
}: {
  model: PlaygroundModel;
  benchmark: ComparisonBenchmark;
}) {
  const motionAllowed = useMotionAllowed();
  const settings = {
    format: model.format,
    duration: model.duration,
    easing: model.easing,
    animated: model.animated && motionAllowed,
    count: model.count,
    font: model.font,
    layout: benchmark.layout,
  };
  async function compare(
    counts: readonly number[],
    engines?: readonly Engine[],
  ) {
    const resume = model.playing;
    model.setPlaying(false);
    try {
      await benchmark.run(
        { ...settings, interval: model.interval },
        counts,
        engines,
      );
    } finally {
      model.setPlaying(resume);
    }
  }
  return (
    <section
      className="browser-benchmark"
      id="comparison"
      aria-label="Browser performance comparison"
    >
      <h2>Comparison</h2>
      <p className="section-description">100 to 1,000 counters.</p>
      <details className="benchmark-tools">
        <summary>Run on your browser</summary>
        <label className="workload-control">
          Workload
          <select
            value={benchmark.layout}
            disabled={benchmark.busy}
            onChange={(event) =>
              benchmark.setLayout(event.target.value as "grid" | "list")
            }
          >
            <option value="grid">Dense grid</option>
            <option value="list">Balance list</option>
          </select>
        </label>
        <button
          type="button"
          disabled={benchmark.busy}
          onClick={() =>
            void compare(
              [100, 250, 500, 1000],
              ["digitloom", "numberflow", "countup"],
            )
          }
        >
          Run benchmark
        </button>
        {benchmark.busy && (
          <button type="button" onClick={benchmark.stop}>
            Stop
          </button>
        )}
        <p className="benchmark-status" role="status">
          {benchmark.busy
            ? `${ENGINE_NAMES[benchmark.active]} · ${benchmark.activeCount} counters · round ${benchmark.round} of 2. Keep the sample visible and this page in front.`
            : benchmark.message}
        </p>
        <div
          className={`benchmark-stage face-${model.font} palette-${model.palette}`}
          hidden={!benchmark.busy}
        >
          <div className="preview-caption">
            {ENGINE_NAMES[benchmark.active]} · measured sample
          </div>
          <div ref={benchmark.stage} />
        </div>
      </details>
      <ScalingChart
        runs={benchmark.runs}
        includedCapture={benchmark.includedCapture}
      />
    </section>
  );
}
