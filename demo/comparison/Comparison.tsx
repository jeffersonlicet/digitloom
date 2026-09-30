/** @fileoverview Shows synchronized animations and an isolated browser comparison. */
import React from "react";
import sizes from "../library-sizes.json";
import type { PlaygroundModel } from "../usePlayground";
import { CounterGrid, ENGINE_NAMES } from "./renderers";
import { useMotionAllowed } from "./useMotionAllowed";
import type { ComparisonBenchmark } from "./useComparisonBenchmark";

export function Comparison({
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
  };
  return (
    <>
      <div
        className={`preview comparison-preview palette-${model.palette} face-${model.font}`}
      >
        <div className="preview-caption">
          <span>Live demo</span>
          <span>
            {model.count} {model.count === 1 ? "counter" : "counters"} per
            renderer
          </span>
        </div>
        {!benchmark.busy && (
          <div className="comparison-grid">
            {(["digitloom", "numberflow", "countup"] as const).map((engine) => (
              <article
                className={`comparison-card ${engine === "digitloom" ? "featured-library" : ""}`}
                key={engine}
              >
                <div className="library-heading">
                  <h3>{ENGINE_NAMES[engine]}</h3>
                </div>
                <CounterGrid
                  engine={engine}
                  value={model.value}
                  {...settings}
                />
                <small>
                  {`${(sizes.libraries[engine].gzipBytes / 1024).toFixed(2)} KiB gzip`}
                </small>
              </article>
            ))}
          </div>
        )}
        <div className="preview-actions">
          <button
            type="button"
            onClick={model.changeValue}
            disabled={benchmark.busy}
          >
            Change all values <span aria-hidden="true">↗</span>
          </button>
          <button
            type="button"
            disabled={benchmark.busy}
            aria-pressed={model.playing}
            onClick={() => model.setPlaying(!model.playing)}
          >
            {model.playing ? "Pause updates" : "Auto update"}
          </button>
        </div>
      </div>
    </>
  );
}
