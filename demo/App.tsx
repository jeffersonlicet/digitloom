/** @fileoverview Composes the live playground, customization controls, and integration example. */
import React, { useEffect } from "react";
import { BrowserComparison } from "./comparison/BrowserComparison";
import { Comparison } from "./comparison/Comparison";
import { useComparisonBenchmark } from "./comparison/useComparisonBenchmark";
import { Controls } from "./Controls";
import { usePlayground } from "./usePlayground";
import { UsageGuide } from "./UsageGuide";
import { HeroCounter } from "./HeroCounter";

export function App() {
  useEffect(() => {
    document.title = "Digitloom — Rolling numbers for React";
  }, []);
  const benchmark = useComparisonBenchmark();
  const model = usePlayground(benchmark.busy);
  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="./">
          Digitloom<span aria-hidden="true">.</span>
        </a>
        <div className="masthead-links">
          <a href="#demo">Demo</a>
          <a href="#comparison">Comparison</a>
          <a href="#getting-started">How to</a>
          <span className="release">v1.0.7 · MIT</span>
        </div>
      </header>
      <section className="intro">
        <div className="intro-copy">
          <p className="hero-kicker">Digitloom for React</p>
          <h1>
            Numbers in
            <br />
            motion.
          </h1>
        </div>
        <div className="hero-motion">
          <HeroCounter
            playing={model.playing && !benchmark.busy}
            animated={model.animated && !benchmark.busy}
          />
        </div>
      </section>
      <section
        id="demo"
        className="playground"
        aria-label="Live Digitloom playground"
      >
        <h2>Demo</h2>
        <div className="preview-column">
          <Comparison model={model} benchmark={benchmark} />
        </div>
        <details className="customization">
          <summary>Customize motion</summary>
          <fieldset className="controls-fieldset" disabled={benchmark.busy}>
            <Controls model={model} />
          </fieldset>
        </details>
      </section>
      <BrowserComparison model={model} benchmark={benchmark} />
      <UsageGuide />
      <footer>
        <span>
          Digitloom ·{" "}
          <a href="./THIRD_PARTY_NOTICES.txt">Third-party notices</a>
        </span>
        <a href="https://github.com/jeffersonlicet/digitloom">GitHub ↗</a>
      </footer>
    </main>
  );
}
