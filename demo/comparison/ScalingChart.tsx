/** @fileoverview Plots measured renderer costs as the counter workload grows. */
import React from "react";
import { ENGINES, ENGINE_NAMES, type Engine } from "./renderers";
import { percentile } from "./measure";
import type { ComparisonRun } from "./useComparisonBenchmark";

type Metric = "update" | "frame" | "maximum";
const COLORS: Record<Engine, string> = {
  digitloom: "var(--digitloom-green)",
  numberflow: "#86868b",
  countup: "#007aff",
  static: "#838d83",
};
const LABELS: Record<Metric, string> = {
  update: "Synchronous update p95",
  frame: "Frame gap p95",
  maximum: "Maximum frame gap",
};
export function measuredCost(
  run: ComparisonRun,
  engine: Engine,
  metric: Metric,
): number | null {
  const samples = run.samples.filter((sample) => sample.engine === engine);
  if (!samples.length) return null;
  const values = samples.flatMap((sample) =>
    metric === "update" ? sample.commitsMs : sample.frameGapsMs,
  );
  return metric === "maximum"
    ? values.length
      ? Math.max(...values)
      : null
    : percentile(values, 0.95);
}

export function ScalingChart({
  runs,
  includedCapture,
}: {
  runs: ComparisonRun[];
  includedCapture: boolean;
}) {
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ runs }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "digitloom-browser-comparison.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const metric: Metric = "frame";
  const scale = "log" as const;
  const visible: Record<Engine, boolean> = {
    digitloom: true,
    numberflow: true,
    countup: true,
    static: true,
  };
  const available = ENGINES.filter((engine) =>
    runs.some((run) => run.samples.some((sample) => sample.engine === engine)),
  );
  const names = {
    ...ENGINE_NAMES,
    numberflow:
      runs.length && !runs[0].numberFlowGrouped
        ? "NumberFlow (ungrouped)"
        : ENGINE_NAMES.numberflow,
  };
  const largest = runs.reduce<ComparisonRun | null>(
    (selected, run) =>
      !selected || run.settings.count > selected.settings.count
        ? run
        : selected,
    null,
  );
  const costs = runs.flatMap((run) =>
    available.flatMap((engine) => {
      const cost = measuredCost(run, engine, metric);
      return cost === null || cost <= 0 ? [] : [cost];
    }),
  );
  const minimum = Math.min(...costs, 10) * 0.7;
  const maximum = Math.max(...costs, 100) * 1.25;
  const lower = Math.log10(minimum);
  const upper = Math.log10(maximum);
  const ticks = [10, 100, 1000, 10000].filter(
    (tick) => tick >= minimum && tick <= maximum,
  );
  const maximumCount = Math.max(1000, ...runs.map((run) => run.settings.count));
  const minimumCount = Math.min(100, ...runs.map((run) => run.settings.count));
  const x = (count: number) =>
    48 + ((count - minimumCount) / (maximumCount - minimumCount)) * 600;
  const y = (value: number) =>
    280 - ((Math.log10(value) - lower) / (upper - lower)) * 232;
  const series = available.map((engine) => ({
    engine,
    points: runs
      .flatMap((run) => {
        const value = measuredCost(run, engine, metric);
        return value === null || (scale === "log" && value <= 0)
          ? []
          : [{ count: run.settings.count, value }];
      })
      .sort((left, right) => left.count - right.count),
  }));
  return (
    <section className="scaling-chart" aria-label="Renderer scaling chart">
      <div className="chart-heading">
        <div>
          <h3>
            {runs[0]?.settings.layout === "list"
              ? "Balance lists"
              : "Dense grids"}
            .
          </h3>
        </div>
      </div>
      {largest && (
        <div className="chart-summary">
          {available.map((engine) => (
            <div
              key={engine}
              className={
                engine === "digitloom"
                  ? "chart-score featured-score"
                  : "chart-score"
              }
            >
              <span>
                <i style={{ backgroundColor: COLORS[engine] }} />
                {engine === "digitloom"
                  ? "Digitloom"
                  : engine === "numberflow"
                    ? "NumberFlow"
                    : names[engine]}
              </span>
              <strong>
                {measuredCost(largest, engine, metric)?.toFixed(1) ?? "—"}
                <small> ms</small>
              </strong>
            </div>
          ))}
        </div>
      )}
      <p className="chart-unit">
        Frame delay p95 · lower is better
        {largest
          ? ` · ${largest.settings.count.toLocaleString()} counters`
          : ""}
      </p>
      <svg
        className="scaling-plot"
        viewBox="0 0 720 344"
        role="img"
        aria-label={`${LABELS[metric]} in milliseconds by counter count. ${scale === "log" ? "Logarithmic" : "Linear"} scale. Lower is better.`}
      >
        <title>Measured renderer scaling</title>
        <desc>
          The horizontal axis shows mounted counters from 100 to {maximumCount}.
          The table below contains the measured values. Frame gaps are
          scheduling measurements.
        </desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1="48"
              x2="648"
              y1={y(tick)}
              y2={y(tick)}
              className="chart-gridline"
            />
            <text x="32" y={y(tick) + 4} textAnchor="end">
              {tick.toLocaleString("en-US", { maximumFractionDigits: 6 })}
            </text>
          </g>
        ))}
        <text x="48" y="24">
          Frame delay · ms · logarithmic scale
        </text>
        {[100, 250, 500, maximumCount].map((count) => (
          <text key={count} x={x(count)} y="308" textAnchor="middle">
            {count.toLocaleString()}
          </text>
        ))}
        <text x="348" y="338" textAnchor="middle">
          Mounted counters
        </text>
        {series
          .filter(({ engine }) => visible[engine])
          .map(({ engine, points }) => (
            <g key={engine}>
              {engine === "digitloom" && points.length > 1 && (
                <path
                  d={`M${x(points[0].count)},280 ${points.map((point) => `L${x(point.count)},${y(point.value)}`).join(" ")} L${x(points[points.length - 1].count)},280 Z`}
                  fill="var(--digitloom-green)"
                  opacity="0.06"
                />
              )}
              <path
                d={points
                  .map(
                    (point, index) =>
                      `${index ? "L" : "M"}${x(point.count)},${y(point.value)}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={COLORS[engine]}
                strokeWidth={engine === "digitloom" ? 3.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point) => (
                <circle
                  key={point.count}
                  cx={x(point.count)}
                  cy={y(point.value)}
                  r={engine === "digitloom" ? 5 : 3.5}
                  fill={COLORS[engine]}
                  stroke="white"
                  strokeWidth="2"
                >
                  <title>
                    {names[engine]} · {point.count} counters ·{" "}
                    {point.value.toFixed(2)} ms
                  </title>
                </circle>
              ))}
            </g>
          ))}
        {!runs.length && (
          <text x="348" y="150" textAnchor="middle">
            Run the scaling comparison to plot real measurements.
          </text>
        )}
      </svg>
      <p className="comparison-note chart-caption">
        {includedCapture ? "Latest check" : "This session"}
        {largest &&
          ` · ${new Date(largest.capturedAt).toLocaleDateString()} · ${Math.min(...largest.samples.map((sample) => sample.visibility.count))} visible counters${largest.complete ? "" : " · partial samples"}`}
      </p>
      {runs.length > 0 && (
        <details>
          <summary>Measurement details</summary>
          <p className="comparison-note">
            {scale === "log"
              ? "Each vertical step is a tenfold increase. Zero values are omitted from the log plot."
              : "The vertical axis starts at zero."}{" "}
            All three renderers remain visible. The table contains the actual
            observations.
          </p>
          <p className="comparison-note">
            {includedCapture
              ? `Included local preview capture · Digitloom ${runs[0]?.versions.digitloom}.`
              : "Measurements from this browser session."}{" "}
            {largest
              ? `${largest.settings.interval} ms updates, ${largest.settings.duration} ms motion, ${largest.viewport.width} × ${largest.viewport.height} viewport. Captured ${new Date(largest.capturedAt).toLocaleDateString()}.`
              : "No measured results yet."}{" "}
            Completed points have two rounds and 16 updates per renderer. Each
            round uses {largest?.warmupUpdates ?? 2} warmup updates. The
            nearest-rank update p95 is the largest of these 16 observations.
            CountUp uses a counting animation.{" "}
            {available.includes("numberflow")
              ? runs.length && !runs[0].numberFlowGrouped
                ? "This capture uses ungrouped NumberFlow."
                : "NumberFlow uses its public group API."
              : "This capture compares Digitloom and CountUp directly."}{" "}
            Native viewport behavior and host load affect results. Offscreen
            counters remain mounted. Visibility counts include ancestor
            clipping. Partial points show their actual sample counts in the
            table.
          </p>
          {largest?.settings.layout === "list" && (
            <p className="comparison-note">
              Three counters per row. The list scrolls after the fourth update
              when the sample reaches that point.
            </p>
          )}
          <p className="comparison-note">
            Frame gaps measure scheduling, not GPU frames. These are local
            browser samples.
          </p>
          <div className="table-scroll">
            <table>
              <caption>{LABELS[metric]} · milliseconds</caption>
              <thead>
                <tr>
                  <th scope="col">Mounted / visibility sample</th>
                  {available.map((engine) => (
                    <th key={engine} scope="col">
                      {names[engine]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.settings.count}>
                    <th scope="row">
                      {run.settings.count} /{" "}
                      {Math.min(
                        ...run.samples.map((sample) => sample.visibility.count),
                      )}
                      –
                      {Math.max(
                        ...run.samples.map((sample) => sample.visibility.count),
                      )}
                      {run.samples[0]?.visibility.method === "intersection"
                        ? " visible"
                        : " viewport boxes"}
                      {run.complete ? "" : " (partial)"}
                    </th>
                    {available.map((engine) => {
                      const samples = run.samples.filter(
                        (sample) => sample.engine === engine,
                      );
                      const updates = samples.reduce(
                        (total, sample) => total + sample.commitsMs.length,
                        0,
                      );
                      return (
                        <td key={engine}>
                          {measuredCost(run, engine, metric)?.toFixed(2) ?? "—"}
                          <small>
                            {updates} updates
                            {samples.some(
                              (sample) => sample.status === "budget-limited",
                            )
                              ? " · sampling limit"
                              : ""}
                          </small>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {runs.length > 0 && (
        <details className="raw-results">
          <summary>Raw measurement data</summary>
          <pre data-testid="comparison-raw-data">
            {JSON.stringify({ runs })}
          </pre>
        </details>
      )}
      {runs.length > 0 && (
        <button className="download-chart" type="button" onClick={download}>
          Download raw results
        </button>
      )}
    </section>
  );
}
