/** @fileoverview Coordinates selectable text and cached canvas digit motion. */
import { motionProgress } from "./motionProgress.js";
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
  private clocks = new Set<Clock>();
  private paintLeft = 0;
  private x = 0;
  private origin = 0;
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
    this.immediate = false;
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
    if (!pending.has(this)) this.immediate = true;
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
        advances: new Map(),
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
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportWidth = viewport?.width ?? view.innerWidth;
    const crop = canvasViewport(
      {
        left: gridBounds.left + borderLeft,
        top: gridBounds.top + borderTop,
        width: this.grid.clientWidth,
        height: this.grid.clientHeight,
      },
      {
        left: viewportLeft,
        top: viewport?.offsetTop ?? 0,
        width: viewportWidth,
        height: viewport?.height ?? view.innerHeight,
      },
    );
    const leftLimit = Math.min(
      viewportWidth,
      Math.max(0, gridBounds.left + borderLeft + crop.left - viewportLeft),
    );
    const characters = planNumberCharacters(this.settings.value);
    const text = this.host.querySelector(".rolling-number__text")?.firstChild;
    if (!text) return null;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, characters[0].text.length);
    let x = range.getBoundingClientRect().left - bounds.left;
    const rtl = style.direction === "rtl";
    let offset = 0;
    const positioned = characters.map((character) => {
      let width = atlas.advances.get(character.text);
      if (width === undefined || rtl) {
        range.setStart(text, offset);
        range.setEnd(text, offset + character.text.length);
        const box = range.getBoundingClientRect();
        width = box.width;
        if (rtl) x = box.left - bounds.left;
        if (atlas.advances.size >= 512) atlas.advances.clear();
        atlas.advances.set(character.text, width);
      }
      offset += character.text.length;
      const cell = { ...character, x };
      x += width;
      return cell;
    });
    return {
      characters: positioned,
      left: this.grid.scrollLeft + crop.left,
      top: this.grid.scrollTop + crop.top,
      atlas,
      width: bounds.width,
      x: bounds.left - gridBounds.left - borderLeft - crop.left,
      origin: bounds.left,
      y: bounds.top - gridBounds.top - borderTop - crop.top,
      gridWidth: crop.width,
      leftLimit,
      rightLimit: Math.max(0, viewportWidth - crop.width - leftLimit),
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
      origin: number;
      y: number;
      gridWidth: number;
      leftLimit: number;
      rightLimit: number;
      gridHeight: number;
    } | null,
    clocks: Map<string, Clock>,
  ) {
    const settings = this.settings;
    if (!prepared || !settings) return;
    const progress = motionProgress(this.clock);
    const layoutOnly = this.previous === settings.value && this.clock;
    const oldCells = new Map(this.cells.map((cell) => [cell.key, cell]));
    const duration = this.immediate ? 0 : settings.duration;
    const key = `${duration}|${settings.easing}`;
    let clock = layoutOnly || clocks.get(key);
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
    const trend = compareNumberValues(this.previous, settings.value);
    const previous = new Map(
      planNumberCharacters(this.previous).map((cell) => [cell.key, cell.digit]),
    );
    this.cells = prepared.characters.map((cell) => {
      const oldCell = oldCells.get(cell.key);
      if (layoutOnly && oldCell) {
        return {
          ...oldCell,
          x: cell.x,
        };
      }
      const positioned = {
        ...cell,
        offsetX: oldCell
          ? this.origin -
            prepared.origin +
            oldCell.x -
            cell.x +
            (oldCell.offsetX ?? 0) * (1 - progress)
          : 0,
      };
      if (cell.digit === undefined) return positioned;
      const from = centerReel(oldCell?.to ?? previous.get(cell.key) ?? 0);
      let to = targetReelIndex(from, cell.digit, trend);
      if (!previous.has(cell.key) && cell.digit === 0)
        to += trend < 0 ? -10 : 10;
      const rolls = (oldCell?.rolls ?? []).filter(
        (roll) => roll.clock.animation.playState !== "finished",
      );
      if (to !== from) rolls.push({ delta: to - from, clock });
      return { ...positioned, to, rolls };
    });
    this.clock = clock;
    this.syncClocks(
      new Set([
        clock,
        ...this.cells.flatMap((cell) =>
          (cell.rolls ?? []).map((roll) => roll.clock),
        ),
      ]),
    );
    this.previous = settings.value;
    this.atlas = prepared.atlas;
    this.x = prepared.x;
    this.origin = prepared.origin;
    this.y = prepared.y;
    const offsets = this.cells.map((cell) => cell.offsetX ?? 0);
    this.paintLeft = Math.min(0, ...offsets);
    this.paintWidth =
      prepared.width +
      Math.max(0, ...offsets) -
      this.paintLeft +
      Math.max(8, -prepared.atlas.spacing + 4);
    this.surface.ratio = prepared.atlas.ratio;
    const canvas = this.surface.canvas;
    this.surface.leftBleed = Math.min(
      prepared.leftLimit,
      Math.max(this.surface.leftBleed, -this.x - this.paintLeft),
    );
    this.surface.bleed = Math.min(
      prepared.rightLimit,
      Math.max(
        this.surface.bleed,
        this.x + this.paintLeft + this.paintWidth - prepared.gridWidth,
      ),
    );
    const left = prepared.left - this.surface.leftBleed;
    if (canvas.style.left !== `${left}px`) canvas.style.left = `${left}px`;
    if (canvas.style.top !== `${prepared.top}px`)
      canvas.style.top = `${prepared.top}px`;
    const surfaceWidth =
      prepared.gridWidth + this.surface.bleed + this.surface.leftBleed;
    const width = Math.ceil(surfaceWidth * this.surface.ratio);
    const height = Math.ceil(prepared.gridHeight * this.surface.ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${surfaceWidth}px`;
      canvas.style.height = `${prepared.gridHeight}px`;
    }
    this.immediate = false;
    if (layoutOnly) return;
    this.host.dataset.rollingReady = "";
    active.add(this);
  }
  /** Draws this counter without clearing neighboring pixels on the shared surface. */
  draw(progressCache = new Map<Clock, number>()) {
    const atlas = this.atlas;
    const context = this.surface.context;
    if (!atlas || !context || !this.cells.length) return;
    const progress = motionProgress(this.clock, progressCache);
    context.save();
    context.imageSmoothingQuality = "high";
    context.setTransform(
      atlas.ratio,
      0,
      0,
      atlas.ratio,
      this.surface.leftBleed * atlas.ratio,
      this.y * atlas.ratio,
    );

    context.beginPath();
    context.rect(
      this.x + this.paintLeft - 2,
      0,
      this.paintWidth + 4,
      atlas.height,
    );
    context.clip();
    this.cells.forEach((cell) => {
      const current = glyph(atlas, cell.text);
      const x =
        Math.round(
          (this.x + cell.x + (cell.offsetX ?? 0) * (1 - progress)) *
            atlas.ratio,
        ) / atlas.ratio;
      if (cell.to === undefined) {
        context.drawImage(
          current.canvas,
          x - 2,
          0,
          current.canvas.width / atlas.ratio,
          current.canvas.height / atlas.ratio,
        );
      } else {
        const position =
          cell.to -
          (cell.rolls ?? []).reduce(
            (offset, roll) =>
              offset +
              roll.delta * (1 - motionProgress(roll.clock, progressCache)),
            0,
          );
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
          // Skip subpixel ink slivers without changing the glyph color.
          if (visibleInk * atlas.ratio < 1) continue;
          context.drawImage(
            image.canvas,
            x - 2,
            y,
            image.canvas.width / atlas.ratio,
            image.canvas.height / atlas.ratio,
          );
        }
      }
    });
    context.restore();
    if (
      [...this.clocks].every(
        (clock) => clock.animation.playState === "finished",
      )
    ) {
      active.delete(this);
      this.releaseClock();
      this.cells.forEach((cell) => {
        delete cell.rolls;
      });
    }
  }
  private syncClocks(next: Set<Clock>) {
    this.clocks.forEach((clock) => {
      if (!next.has(clock) && --clock.users === 0) clock.animation.cancel();
    });
    next.forEach((clock) => {
      if (!this.clocks.has(clock)) clock.users += 1;
    });
    this.clocks = next;
  }
  releaseClock() {
    this.syncClocks(new Set());
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
