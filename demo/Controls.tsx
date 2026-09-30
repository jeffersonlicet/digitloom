/** @fileoverview Presents labeled customization controls for the live counter examples. */
import React, { useState } from "react";
import type {
  FontFace,
  NumberFormat,
  Palette,
  PlaygroundModel,
} from "./usePlayground";

export function Controls({ model }: { model: PlaygroundModel }) {
  const [input, setInput] = useState("1234.56");
  return (
    <aside className="controls" aria-label="Counter settings">
      <p className="eyebrow">Make it yours</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = Number(input);
          if (!input.trim() || !Number.isFinite(next)) return;
          model.setPlaying(false);
          model.setValue(next);
        }}
      >
        <label htmlFor="number-value">Value</label>
        <div className="input-row">
          <input
            id="number-value"
            type="number"
            min={-1e12}
            max={1e12}
            step="any"
            required
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button className="apply" type="submit">
            Apply
          </button>
        </div>
      </form>
      <label htmlFor="duration">
        Duration <output>{model.duration} ms</output>
      </label>
      <input
        id="duration"
        type="range"
        min="0"
        max="1200"
        step="50"
        value={model.duration}
        onChange={(event) => model.setDuration(Number(event.target.value))}
      />
      <label htmlFor="easing">Easing</label>
      <select
        id="easing"
        value={model.easing}
        onChange={(event) => model.setEasing(event.target.value)}
      >
        <option value="cubic-bezier(0.16,1,0.3,1)">Smooth out</option>
        <option value="ease-in-out">Ease in and out</option>
        <option value="linear">Linear</option>
        <option value="steps(6,end)">Six steps</option>
      </select>
      <div className="control-pair">
        <div>
          <label htmlFor="format">Format</label>
          <select
            id="format"
            value={model.format}
            onChange={(event) =>
              model.setFormat(event.target.value as NumberFormat)
            }
          >
            <option value="decimal">Decimal</option>
            <option value="currency">Currency</option>
            <option value="percent">Percent</option>
          </select>
        </div>
        <div>
          <label htmlFor="font">Typeface</label>
          <select
            id="font"
            value={model.font}
            onChange={(event) => model.setFont(event.target.value as FontFace)}
          >
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </div>
      </div>
      <label htmlFor="palette">Palette</label>
      <select
        id="palette"
        value={model.palette}
        onChange={(event) => model.setPalette(event.target.value as Palette)}
      >
        <option value="paper">Paper</option>
        <option value="sage">Sage</option>
        <option value="ink">Ink</option>
      </select>
      <div className="control-pair">
        <div>
          <label htmlFor="count">Counters</label>
          <select
            id="count"
            value={model.count}
            onChange={(event) => model.setCount(Number(event.target.value))}
          >
            {[1, 3, 12, 27, 100].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="interval">Update interval</label>
          <select
            id="interval"
            value={model.interval}
            onChange={(event) =>
              model.setIntervalMs(Number(event.target.value))
            }
          >
            <option value={1000}>1 second</option>
            <option value={500}>500 ms</option>
            <option value={100}>100 ms</option>
          </select>
        </div>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={model.animated}
          onChange={(event) => model.setAnimated(event.target.checked)}
        />{" "}
        Enable animation
      </label>
    </aside>
  );
}
