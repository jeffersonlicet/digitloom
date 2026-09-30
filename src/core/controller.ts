/** @fileoverview Coordinates selectable text and cached canvas digit motion. */
import { canvasViewport } from "./canvasViewport.js";
import { observeNumberMotion } from "./visibility.js";
import {
  planNumberCharacters,
  centerReel,
  targetReelIndex,
  compareNumberValues,
} from "./characters.js";
import { getSurface, surfaces } from "./canvasSurface.js";
import { glyph, atlases } from "./glyphAtlas.js";
import {
  active,
  pending,
  schedule,
  invalidateSurface,
  stopIdleFrame,
} from "./canvasScheduler.js";
import type { Settings, Cell, Atlas, Surface, Clock } from "./canvas.types.js";
export class CanvasMotion {
  private destroyed = false;
  private settings: Settings | null = null;
  private immediate = false;
  private previous = "";
  private allowed = false;
  private cells: Cell[] = [];
  private atlas: Atlas | null = null;
  private clock: Clock | null = null;
  private width = 0;
  private x = 0;
  private paintLeft = 0;
  private paintWidth = 0;
  private y = 0;
  readonly surface: Surface;
  private grid: HTMLElement;
  private readonly stop: () => void;
  constructor(private host: HTMLSpanElement) {
    const grid = host.closest<HTMLElement>("[data-digitloom-group]") ?? host;
    this.grid = grid;
    this.surface = getSurface(grid);
    this.surface.motions.add(this);
    this.stop = observeNumberMotion(host, (allowed) => {
      if (allowed === this.allowed) return;
      this.allowed = allowed;
      if (!allowed) this.settle();
      this.previous = this.settings?.value ?? "";
    });
  }
  update(settings: Settings) {
    this.settings = settings;
    if (!this.allowed || !settings.animated || !settings.duration) {
      this.settle();
      this.previous = settings.value;
      return;
    }
    schedule(this);
  }
  refresh() {
    if (!this.allowed || !this.settings?.animated || !this.settings.duration)
      return;
    this.immediate = true;
    schedule(this);
  }
  prepare() {
    if (!this.settings || !this.allowed) return null;
    const style = getComputedStyle(this.host);
    const bounds = this.host.getBoundingClientRect();
    const document = this.host.ownerDocument;
    const view = document.defaultView;
    if (!view) return null;
    const ratio = view.devicePixelRatio * (view.visualViewport?.scale ?? 1);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = Number.parseFloat(style.letterSpacing) || 0;
    const key = `${font}|${style.color}|${bounds.height}|${ratio}|${spacing}|${style.fontVariantNumeric}`;
    let atlas = atlases.get(key);
    if (!atlas) {
      const probe = document.createElement("canvas").getContext("2d");
      if (!probe) throw new Error("Canvas 2D is unavailable.");
      probe.font = font;
      const metrics = probe.measureText("0123456789");
      const ascent = metrics.fontBoundingBoxAscent;
      const descent = metrics.fontBoundingBoxDescent;
      atlas = {
        document,
        baseline: (bounds.height - ascent - descent) / 2 + ascent,
        spacing,
        positions: new Map(),
        glyphs: new Map(),
        font,
        color: style.color,
        height: bounds.height,
        ratio,
      };
      if (atlases.size >= 32) atlases.clear();
      atlases.set(key, atlas);
    }
    const gridBounds = this.grid.getBoundingClientRect();
    const gridStyle = getComputedStyle(this.grid);
    const borderLeft = parseFloat(gridStyle.borderLeftWidth) || 0;
    const borderTop = parseFloat(gridStyle.borderTopWidth) || 0;
    const viewport = view.visualViewport;
    const crop = canvasViewport(
      {
        left: gridBounds.left + borderLeft,
        top: gridBounds.top + borderTop,
        width: this.grid.clientWidth,
        height: this.grid.clientHeight,
      },
      {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? view.innerWidth,
        height: viewport?.height ?? view.innerHeight,
      },
    );
    const characters = planNumberCharacters(this.settings.value);
    const shape = style.fontVariantNumeric.includes("tabular-nums")
      ? this.settings.value.replace(/\d/g, "0")
      : this.settings.value;
    let positions = atlas.positions.get(shape);
    if (!positions) {
      const text = this.host.querySelector(".rolling-number__text")?.firstChild;
      if (!text) return null;
      const range = document.createRange();
      let offset = 0;
      positions = characters.map((character) => {
        range.setStart(text, offset);
        offset += character.text.length;
        range.setEnd(text, offset);
        const box = range.getBoundingClientRect();
        return { x: box.left - bounds.left, width: box.width };
      });
      if (atlas.positions.size >= 512) atlas.positions.clear();
      atlas.positions.set(shape, positions);
    }
    return {
      characters: characters.map((cell, index) => ({
        ...cell,
        ...positions[index],
      })),
      left: this.grid.scrollLeft + crop.left,
      top: this.grid.scrollTop + crop.top,
      atlas,
      width: bounds.width,
      x: bounds.left - gridBounds.left - borderLeft - crop.left,
      y: bounds.top - gridBounds.top - borderTop - crop.top,
      gridWidth: crop.width,
      gridHeight: crop.height,
    };
  }
  start(
    prepared: {
      characters: (Cell & { digit?: number })[];
      left: number;
      top: number;
      atlas: Atlas;
      width: number;
      x: number;
      y: number;
      gridWidth: number;
      gridHeight: number;
    } | null,
    clocks: Map<string, Clock>,
  ) {
    const settings = this.settings;
    if (!prepared || !settings) return;
    const progress = Number(
      this.clock?.animation.effect?.getComputedTiming().progress ?? 1,
    );
    const positions = new Map(
      (this.clock ? this.cells : []).map((cell) => [
        cell.key,
        cell.from === undefined || cell.to === undefined
          ? undefined
          : cell.from + (cell.to - cell.from) * progress,
      ]),
    );
    const layoutOnly =
      this.immediate && this.previous === settings.value && this.clock;
    const oldCells = new Map(this.cells.map((cell) => [cell.key, cell]));
    if (!layoutOnly) this.releaseClock();
    const trend = compareNumberValues(this.previous, settings.value);
    const previous = new Map(
      planNumberCharacters(this.previous).map((cell) => [cell.key, cell.digit]),
    );
    this.cells = prepared.characters.map((cell) => {
      const oldCell = oldCells.get(cell.key);
      if (layoutOnly && oldCell) {
        return { ...cell, from: oldCell.from, to: oldCell.to };
      }
      if (cell.digit === undefined) return cell;
      const old = positions.get(cell.key) ?? previous.get(cell.key) ?? 0;
      const from = centerReel(old);
      return {
        ...cell,
        from,
        to: targetReelIndex(from, cell.digit, trend),
      };
    });
    this.previous = settings.value;
    this.atlas = prepared.atlas;
    this.width = prepared.width;
    this.x = prepared.x;
    this.y = prepared.y;
    this.paintLeft = this.x;
    this.paintWidth = this.width + Math.max(8, -prepared.atlas.spacing + 4);
    this.surface.ratio = prepared.atlas.ratio;
    const canvas = this.surface.canvas;
    if (canvas.style.left !== `${prepared.left}px`)
      canvas.style.left = `${prepared.left}px`;
    if (canvas.style.top !== `${prepared.top}px`)
      canvas.style.top = `${prepared.top}px`;
    this.surface.bleed = Math.max(
      this.surface.bleed,
      -prepared.atlas.spacing + 4,
    );
    const width = Math.ceil(
      (prepared.gridWidth + this.surface.bleed) * this.surface.ratio,
    );
    const height = Math.ceil(prepared.gridHeight * this.surface.ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${prepared.gridWidth + this.surface.bleed}px`;
      canvas.style.height = `${prepared.gridHeight}px`;
    }
    const duration = this.immediate ? 0 : settings.duration;
    this.immediate = false;
    if (layoutOnly) return;
    const key = `${duration}|${settings.easing}`;
    let clock = clocks.get(key);
    if (!clock) {
      const animation = new Animation(
        new KeyframeEffect(null, [], {
          duration,
          easing: settings.easing,
          fill: "both",
        }),
        this.host.ownerDocument.timeline,
      );
      animation.currentTime = 0;
      animation.play();
      clock = { animation, users: 0 };
      clocks.set(key, clock);
    }
    clock.users += 1;
    this.clock = clock;
    this.host.dataset.rollingReady = "";
    active.add(this);
  }
  /** Draws this counter without clearing neighboring pixels on the shared surface. */
  draw(progressCache = new Map<Clock, number>()) {
    const atlas = this.atlas;
    const context = this.surface.context;
    if (!atlas || !context || !this.cells.length) return;
    let progress = this.clock ? progressCache.get(this.clock) : 1;
    if (progress === undefined) {
      progress = Number(
        this.clock?.animation.effect?.getComputedTiming().progress ?? 1,
      );
      if (this.clock) progressCache.set(this.clock, progress);
    }
    context.save();
    context.imageSmoothingQuality = "high";
    context.setTransform(
      atlas.ratio,
      0,
      0,
      atlas.ratio,
      0,
      this.y * atlas.ratio,
    );

    context.beginPath();
    context.rect(this.paintLeft - 2, 0, this.paintWidth + 4, atlas.height);
    context.clip();
    this.cells.forEach((cell) => {
      const current = glyph(atlas, cell.text);
      const x = Math.round((this.x + cell.x) * atlas.ratio) / atlas.ratio;
      if (cell.from === undefined || cell.to === undefined) {
        context.drawImage(
          current.canvas,
          x - 2,
          0,
          current.canvas.width / atlas.ratio,
          current.canvas.height / atlas.ratio,
        );
      } else {
        const position = cell.from + (cell.to - cell.from) * progress;
        const index = Math.floor(position);
        for (let offset = 0; offset <= 1; offset += 1) {
          const image = glyph(
            atlas,
            String((((index + offset) % 10) + 10) % 10),
          );
          const y = (index + offset - position) * atlas.height;
          const visibleInk = Math.max(
            0,
            Math.min(atlas.height, y + image.inkBottom) -
              Math.max(0, y + image.inkTop),
          );
          const alpha = Math.min(
            1,
            visibleInk / Math.max(1, atlas.height * 0.14),
          );
          context.globalAlpha = alpha * alpha;
          context.drawImage(
            image.canvas,
            x - 2,
            y,
            image.canvas.width / atlas.ratio,
            image.canvas.height / atlas.ratio,
          );
          context.globalAlpha = 1;
        }
      }
    });
    context.restore();
    if (this.clock?.animation.playState === "finished") {
      active.delete(this);
      this.releaseClock();
    }
  }
  releaseClock() {
    if (this.clock && --this.clock.users === 0) this.clock.animation.cancel();
    this.clock = null;
  }
  settle() {
    this.cells = [];
    pending.delete(this);
    active.delete(this);
    this.releaseClock();
    delete this.host.dataset.rollingReady;
    invalidateSurface(this.surface);
    stopIdleFrame();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.settle();
    this.settings = null;
    this.allowed = false;
    this.stop();
    this.surface.clients -= 1;
    this.surface.motions.delete(this);
    if (!this.surface.clients) {
      this.surface.stopLayout();
      this.surface.canvas.remove();
      surfaces.delete(this.grid);
    }
  }
}
