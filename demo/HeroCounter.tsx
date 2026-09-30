/** @fileoverview Cycles formatted currencies in the hero without changing comparison values. */
import React, { useEffect, useState } from "react";
import { RollingNumber } from "../src/index";
import { useMotionAllowed } from "./comparison/useMotionAllowed";

const examples = [
  { currency: "USD", value: 1234.56 },
  { currency: "EUR", value: 2845.9 },
  { currency: "GBP", value: 987.65 },
  { currency: "JPY", value: 8640 },
].map(({ currency, value }) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value),
);

/** Respects pause controls, reduced motion, and benchmark isolation. */
export function HeroCounter({
  playing,
  animated,
}: {
  playing: boolean;
  animated: boolean;
}) {
  const [index, setIndex] = useState(0);
  const motionAllowed = useMotionAllowed();
  useEffect(() => {
    if (!playing || !motionAllowed) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % examples.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [motionAllowed, playing]);

  return (
    <RollingNumber
      value={examples[index]}
      animated={animated && motionAllowed}
      duration={650}
      easing="cubic-bezier(0.16,1,0.3,1)"
      className="hero-number"
    />
  );
}
