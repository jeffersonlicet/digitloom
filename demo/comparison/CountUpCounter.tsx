/** @fileoverview Uses CountUp's public hook API with a static initial value. */
import React, { useEffect, useId, useRef } from "react";
import { useCountUp } from "react-countup";
import { FORMATTERS } from "./format";
import type { NumberFormat } from "../usePlayground";

export function CountUpCounter({
  value,
  format,
  duration,
  easing,
}: {
  value: number;
  format: NumberFormat;
  duration: number;
  easing: string;
}) {
  const id = useId();
  const initial = useRef(value);
  const { update } = useCountUp({
    ref: id,
    start: initial.current,
    end: initial.current,
    duration: duration / 1000,
    decimals: 2,
    formattingFn: FORMATTERS[format],
    useEasing: easing !== "linear",
    startOnMount: false,
  });
  useEffect(() => {
    update(value);
  }, [update, value]);
  return <span id={id} />;
}
