/** @fileoverview Derives landing-page comparisons from the saved release measurements. */
import baseline from "./scaling-baseline.json";
import sizes from "./library-sizes.json";
import { percentile } from "./comparison/measure";

const grid = baseline.runs.find(
  (run) => run.settings.layout === "grid" && run.settings.count === 1000,
);
function frameDelay(engine: string) {
  return percentile(
    grid?.samples
      .filter((sample) => sample.engine === engine)
      .flatMap((sample) => sample.frameGapsMs) ?? [],
    0.95,
  );
}
const digitloom = frameDelay("digitloom");
const numberflow = frameDelay("numberflow");
export const frameAdvantage =
  digitloom && numberflow ? (numberflow / digitloom).toFixed(0) : null;
export const sizeAdvantage = (
  sizes.libraries.numberflow.gzipBytes / sizes.libraries.digitloom.gzipBytes
).toFixed(1);
