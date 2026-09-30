/** @fileoverview Adapts public library APIs to one shared comparison workload. */
import React, { memo, useMemo } from "react";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { CountUpCounter } from "./CountUpCounter";
import { RollingNumber, RollingNumberGroup } from "../../src/index";
import type { NumberFormat } from "../usePlayground";
import { FORMATTERS, FORMAT_OPTIONS } from "./format";

export const ENGINES = [
  "static",
  "digitloom",
  "numberflow",
  "countup",
] as const;
export type Engine = (typeof ENGINES)[number];
export const ENGINE_NAMES: Record<Engine, string> = {
  static: "Plain React",
  digitloom: "Digitloom",
  numberflow: "NumberFlow",
  countup: "React CountUp",
};
export interface CounterSettings {
  format: NumberFormat;
  duration: number;
  easing: string;
  animated: boolean;
}
interface CounterProps extends CounterSettings {
  engine: Engine;
  value: number;
}

const ComparisonCounter = memo(function ComparisonCounter({
  engine,
  value,
  format,
  duration,
  easing,
  animated,
}: CounterProps) {
  const timing = useMemo(() => ({ duration, easing }), [duration, easing]);
  switch (engine) {
    case "digitloom":
      return (
        <RollingNumber
          value={FORMATTERS[format](value)}
          duration={duration}
          easing={easing}
          animated={animated}
        />
      );
    case "numberflow":
      return (
        <NumberFlow
          value={value}
          locales="en-US"
          format={FORMAT_OPTIONS[format]}
          suffix={format === "percent" ? "%" : undefined}
          animated={animated && duration > 0}
          transformTiming={timing}
          spinTiming={timing}
          opacityTiming={timing}
        />
      );
    case "countup":
      return animated && duration > 0 ? (
        <CountUpCounter
          key={`${format}:${duration}:${easing}`}
          value={value}
          format={format}
          duration={duration}
          easing={easing}
        />
      ) : (
        <span>{FORMATTERS[format](value)}</span>
      );
    case "static":
      return <span>{FORMATTERS[format](value)}</span>;
  }
});

export function CounterGrid({
  engine,
  count,
  value,
  layout = "grid",
  ...settings
}: CounterProps & { count: number; layout?: "grid" | "list" }) {
  const Group = engine === "digitloom" ? RollingNumberGroup : "div";
  const grid = (
    <Group
      className="counter-grid"
      data-density={count === 1 ? "single" : "dense"}
      data-layout={layout}
    >
      {Array.from({ length: count }, (_, index) => (
        <span data-counter key={index}>
          <ComparisonCounter
            engine={engine}
            value={value + index}
            {...settings}
          />
        </span>
      ))}
    </Group>
  );
  return engine === "numberflow" ? (
    <NumberFlowGroup>{grid}</NumberFlowGroup>
  ) : (
    grid
  );
}
