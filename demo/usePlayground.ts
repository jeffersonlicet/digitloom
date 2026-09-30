/** @fileoverview Owns demo settings and bounded, user-controlled value updates. */
import { useEffect, useState } from "react";

import { FORMATTERS } from "./comparison/format";

export type NumberFormat = "decimal" | "currency" | "percent";
export type FontFace = "sans" | "serif" | "mono";
export type Palette = "paper" | "sage" | "ink";

/** Keeps user settings and stops live updates while a comparison is active. */
export function usePlayground(paused: boolean) {
  const [value, setValue] = useState(1234.56);
  const [duration, setDuration] = useState(350);
  const [easing, setEasing] = useState("cubic-bezier(0.16,1,0.3,1)");
  const [format, setFormat] = useState<NumberFormat>("decimal");
  const [font, setFont] = useState<FontFace>("sans");
  const [palette, setPalette] = useState<Palette>("paper");
  const [count, setCount] = useState(1);
  const [interval, setIntervalMs] = useState(1000);
  const [playing, setPlaying] = useState(true);
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    if (!playing || paused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setValue((current) => (current === 1234.56 ? 1987.54 : 1234.56));
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, paused, playing]);

  return {
    value,
    setValue,
    duration,
    setDuration,
    easing,
    setEasing,
    format,
    setFormat,
    font,
    setFont,
    palette,
    setPalette,
    count,
    setCount,
    interval,
    setIntervalMs,
    playing,
    setPlaying,
    animated,
    setAnimated,
    textAt(index: number) {
      return FORMATTERS[format](value + index);
    },
    changeValue() {
      setValue((current) => (current === 1234.56 ? 1987.54 : 1234.56));
    },
  };
}

export type PlaygroundModel = ReturnType<typeof usePlayground>;
