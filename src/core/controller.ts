/** @fileoverview Coordinates selectable text and cached canvas digit motion. */
import { sharedClock, staggerClock } from "./sharedClock.js";
import { motionProgress } from "./motionProgress.js";
import { canvasViewport } from "./canvasViewport.js";
import { observeNumberMotion } from "./visibility.js";
import {
  planNumberCharacters,
  centerReel,
  targetReelIndex,
  compareNumberValues,
} from "./characters.js";
import { getSurface, surfaces, setCanvasPixels } from "./canvasSurface.js";
import { glyph, atlases } from "./glyphAtlas.js";
import {
  active,
  pending,
  schedule,
  invalidateSurface,
  stopIdleFrame,
} from "./canvasScheduler.js";
import type {
  Settings,
  Cell,
  Atlas,
  Surface,
  Clock,
  Clip,
} from "./canvas.types.js";
export class CanvasMotion {
  private destroyed = false;
  private settings: Settings | null = null;
  private immediate = false;
  private previous = "";
  private allowed = false;
  private visibilityObserved = false;
  private cells: (Cell & { offsetX: number; offsetY: number })[] = [];
  private atlas: Atlas | null = null;
  private clock: Clock | null = null;
  private clocks = new Set<Clock>();
  private paintLeft = 0;
  private x = 0;
  private origin = 0;
  private paintWidth = 0;
  private y = 0;
  private clip: Clip | null = null;
  private opacityLayers: HTMLElement[] = [];
  private flexParent: HTMLElement | null = null;
  private textWidth = 0;
  readonly surface: Surface;
  private grid: HTMLElement;
  private readonly stop: () => void;
  constructor(private host: HTMLSpanElement) {
    this.grid = host.closest<HTMLElement>("[data-digitloom-group]") ?? host;
    this.surface = getSurface(this.grid);
    this.surface.motions.add(this);
    this.stop = observeNumberMotion(host, (allowed) => {
      const firstObservation = !this.visibilityObserved;
      this.visibilityObserved = true;
      if (allowed === this.allowed) {
        if (
          firstObservation &&
          allowed &&
          this.settings?.animated &&
          this.settings.duration > 0 &&
          this.previous !== this.settings.value
        )
          schedule(this);
        return;
      }
      this.allowed = allowed;
      if (!allowed) {
        this.settle();
        this.previous = this.settings?.value ?? "";
        return;
      }
      if (firstObservation) {
        if (
          this.settings?.animated &&
          this.settings.duration > 0 &&
          this.previous !== this.settings.value
        )
          schedule(this);
        return;
      }
      this.previous = this.settings?.value ?? "";
    });
  }
  update(settings: Settings) {
    this.settings = settings;
    this.immediate = false;
    if (!settings.value || !settings.animated || !settings.duration) {
      this.settle();
      this.previous = settings.value;
      return;
    }
    if (!this.allowed) {
      this.settle();
      if (this.visibilityObserved || !this.previous)
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
    const element = this.host.firstElementChild;
    const baseline = element?.lastElementChild;
    if (!element?.firstChild?.nodeValue || !baseline) return null;
    const text = element.firstChild;
    const style = getComputedStyle(this.host);
    const bounds = element.getBoundingClientRect();
    if (
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    )
      return null;
    const document = this.host.ownerDocument;
    const view = document.defaultView;
    if (!view) return null;
    const ratio = view.devicePixelRatio * (view.visualViewport?.scale ?? 1);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = parseFloat(style.letterSpacing) || 0;
    const baselineOffset = baseline.getBoundingClientRect().top - bounds.top;
    // Fractional translations perturb DOMRect height without changing the font.
    const key = `${font}|${style.color}|${Math.round(bounds.height * 1000)}|${Math.round(baselineOffset * 1000)}|${ratio}|${spacing}|${style.fontVariantNumeric}`;
    let atlas = atlases.get(key);
    if (!atlas) {
      // Read the fixed marker without changing the live text layout.
      atlas = {
        owner: document,
        baseline: baselineOffset,
        spacing,
        advances: new Map(),
        glyphs: new Map(),
        typeface: font,
        ink: style.color,
        lineHeight: bounds.height,
        ratio,
      };
      if (atlases.size >= 32) atlases.clear();
      atlases.set(key, atlas);
    }
    const gridBounds = this.grid.getBoundingClientRect();
    const gridStyle = getComputedStyle(this.grid);
    const borderLeft = parseFloat(gridStyle.borderLeftWidth) || 0;
    const borderTop = parseFloat(gridStyle.borderTopWidth) || 0;
    let clip: Clip | null = null;
    const opacityLayers: HTMLElement[] = [];
    let flexParent: HTMLElement | null = null;
    for (
      let ancestor: HTMLElement | null = this.host;
      ancestor && ancestor !== this.grid;
      ancestor = ancestor.parentElement
    ) {
      const ancestorStyle = getComputedStyle(ancestor);
      if (
        !flexParent &&
        (ancestorStyle.display === "flex" ||
          ancestorStyle.display === "inline-flex")
      )
        flexParent = ancestor;
      const overflowX = ancestorStyle.overflowX || ancestorStyle.overflow;
      const overflowY = ancestorStyle.overflowY || ancestorStyle.overflow;
      const clipsX = Boolean(overflowX) && overflowX !== "visible";
      const clipsY = Boolean(overflowY) && overflowY !== "visible";
      if (clipsX || clipsY) {
        const rect = ancestor.getBoundingClientRect();
        const scaleX = ancestor.offsetWidth
          ? rect.width / ancestor.offsetWidth
          : 1;
        const scaleY = ancestor.offsetHeight
          ? rect.height / ancestor.offsetHeight
          : 1;
        const left =
          rect.left +
          ancestor.clientLeft * scaleX -
          gridBounds.left -
          borderLeft;
        const top =
          rect.top + ancestor.clientTop * scaleY - gridBounds.top - borderTop;
        const right = left + ancestor.clientWidth * scaleX;
        const bottom = top + ancestor.clientHeight * scaleY;
        clip ??= [-Infinity, -Infinity, Infinity, Infinity];
        if (clipsX) {
          clip[0] = Math.max(clip[0], left);
          clip[2] = Math.min(clip[2], right);
        }
        if (clipsY) {
          clip[1] = Math.max(clip[1], top);
          clip[3] = Math.min(clip[3], bottom);
        }
      }
      const alpha = Number.parseFloat(ancestorStyle.opacity);
      const animatesOpacity =
        typeof ancestor.getAnimations === "function" &&
        ancestor
          .getAnimations()
          .some(
            (animation) =>
              animation.effect instanceof KeyframeEffect &&
              animation.effect
                .getKeyframes()
                .some((frame) => "opacity" in frame),
          );
      if (animatesOpacity || alpha !== 1) opacityLayers.push(ancestor);
    }
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
    if (clip) {
      clip[0] -= crop.left;
      clip[1] -= crop.top;
      clip[2] -= crop.left;
      clip[3] -= crop.top;
    }
    const leftLimit = Math.min(
      viewportWidth,
      Math.max(0, gridBounds.left + borderLeft + crop.left - viewportLeft),
    );
    const characters = planNumberCharacters(this.settings.value);
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
      const cell = { ...character, x, width: width ?? 0 };
      x += width;
      return cell;
    });
    return {
      cells: positioned,
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
      clip,
      opacityLayers,
      flexParent,
    };
  }
  start(
    prepared: {
      cells: (Cell & { digit?: number })[];
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
      clip: Clip | null;
      opacityLayers: HTMLElement[];
      flexParent: HTMLElement | null;
    } | null,
    clocks: Map<string, Clock>,
  ) {
    const settings = this.settings;
    if (!prepared || !settings) {
      if (!prepared) {
        this.settle();
        this.previous = settings?.value ?? this.previous;
      }
      return;
    }
    const progress = motionProgress(this.clock);
    const layoutOnly = this.previous === settings.value && this.clock;
    const oldCells = new Map(this.cells.map((cell) => [cell.place, cell]));
    if (
      this.textWidth &&
      this.textWidth !== prepared.width &&
      prepared.flexParent
    )
      this.surface.layoutChanges.add(prepared.flexParent);
    const duration = this.immediate ? 0 : settings.duration;
    const timeline = this.host.ownerDocument.timeline;
    const clock =
      layoutOnly || sharedClock(clocks, timeline, duration, settings.easing);
    let previousDelta = 0;
    let staggered = false;
    const trend = compareNumberValues(this.previous, settings.value);
    const previous = new Map(
      planNumberCharacters(this.previous).map((cell) => [
        cell.place,
        cell.digit,
      ]),
    );
    this.cells = prepared.cells.map((cell) => {
      const oldCell = oldCells.get(cell.place);
      if (layoutOnly && oldCell) {
        return {
          ...oldCell,
          x: cell.x,
          width: cell.width,
        };
      }
      const positioned = {
        ...cell,
        offsetY: 0,
        offsetX: oldCell
          ? this.origin -
            prepared.origin +
            oldCell.x -
            cell.x +
            oldCell.offsetX * (1 - progress)
          : 0,
      };
      if (cell.digit === undefined) {
        previousDelta = 0;
        return positioned;
      }
      const from = centerReel(oldCell?.to ?? previous.get(cell.place) ?? 0);
      let to = targetReelIndex(from, cell.digit, trend);
      if (!previous.has(cell.place) && cell.digit === 0)
        to += trend < 0 ? -10 : 10;
      const rolls = (oldCell?.rolls ?? []).filter(
        (roll) => roll.clock.animation.playState !== "finished",
      );
      const delta = to - from;
      staggered = delta !== 0 && delta === previousDelta && !staggered;
      previousDelta = delta;
      if (delta)
        rolls.push({
          delta,
          clock: staggered
            ? staggerClock(clock, timeline, duration, settings.easing)
            : clock,
        });
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
    this.clip = prepared.clip;
    this.opacityLayers = prepared.opacityLayers;
    this.flexParent = prepared.flexParent;
    this.textWidth = prepared.width;
    const offsets = this.cells.map((cell) => cell.offsetX);
    this.paintLeft = Math.min(0, ...offsets);
    this.paintWidth =
      prepared.width +
      Math.max(0, ...offsets) -
      this.paintLeft +
      Math.max(8, -prepared.atlas.spacing + 4);
    const ratio = prepared.atlas.ratio;
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
    setCanvasPixels(
      this.surface,
      "left",
      prepared.left - this.surface.leftBleed,
    );
    setCanvasPixels(this.surface, "top", prepared.top);
    const width = Math.ceil(
      (prepared.gridWidth + this.surface.bleed + this.surface.leftBleed) *
        ratio,
    );
    const height = Math.ceil(prepared.gridHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    // Keep one bitmap pixel per device pixel without changing text layout.
    setCanvasPixels(this.surface, "width", width / ratio);
    setCanvasPixels(this.surface, "height", height / ratio);
    this.immediate = false;
    if (layoutOnly) return;
    active.add(this);
  }
  refreshForLayout(changed: Set<HTMLElement>) {
    if (active.has(this) && this.flexParent && changed.has(this.flexParent))
      this.refresh();
  }
  /** Draws this counter without clearing neighboring pixels on the shared surface. */
  draw(
    progressCache?: Map<Clock, number>,
    opacityCache = new Map<HTMLElement, number>(),
  ) {
    const atlas = this.atlas;
    const context = this.surface.context;
    if (!atlas || !this.clock) return;
    const progress = motionProgress(this.clock, progressCache);
    const ratio = atlas.ratio;
    let moving = 0;
    for (const cell of this.cells) {
      cell.offsetY = 0;
      for (const roll of cell.rolls ?? [])
        cell.offsetY +=
          roll.delta * (1 - motionProgress(roll.clock, progressCache));
      moving ||=
        Math.round(cell.offsetX * (1 - progress) * ratio) ||
        Math.round(cell.offsetY * atlas.lineHeight * ratio);
    }
    if (!moving) {
      delete this.host.dataset.rollingReady;
      if (
        [...this.clocks].every(
          (clock) => clock.animation.playState === "finished",
        )
      )
        this.settle(true);
      return;
    }
    this.host.dataset.rollingReady ??= "";
    context.save();
    context.globalAlpha = this.opacityLayers.reduce((alpha, element) => {
      let layerOpacity = opacityCache.get(element);
      if (layerOpacity === undefined) {
        layerOpacity = Number.parseFloat(getComputedStyle(element).opacity);
        if (!Number.isFinite(layerOpacity)) layerOpacity = 1;
        opacityCache.set(element, layerOpacity);
      }
      return alpha * layerOpacity;
    }, 1);
    context.setTransform(
      ratio,
      0,
      0,
      ratio,
      this.surface.leftBleed * ratio,
      this.y * ratio,
    );

    context.beginPath();
    context.rect(
      this.x + this.paintLeft - 2,
      0,
      this.paintWidth + 4,
      atlas.lineHeight,
    );
    context.clip();
    if (this.clip) {
      const [left, top, right, bottom] = this.clip;
      context.beginPath();
      context.rect(
        Number.isFinite(left) ? left : -1e6,
        Number.isFinite(top) ? top - this.y : -1e6,
        Number.isFinite(left) && Number.isFinite(right)
          ? Math.max(0, right - left)
          : 2e6,
        Number.isFinite(top) && Number.isFinite(bottom)
          ? Math.max(0, bottom - top)
          : 2e6,
      );
      context.clip();
    }
    for (const cell of this.cells) {
      const x =
        this.x +
        cell.x +
        Math.round(cell.offsetX * (1 - progress) * ratio) / ratio -
        2;
      if (cell.to === undefined) {
        const current = glyph(atlas, cell.text);
        context.drawImage(
          current.canvas,
          x,
          0,
          current.canvas.width / ratio,
          current.canvas.height / ratio,
        );
      } else {
        const position = cell.to - cell.offsetY;
        const index = Math.floor(position);
        for (let offset = 0; offset <= 1; offset += 1) {
          const image = glyph(
            atlas,
            String((((index + offset) % 10) + 10) % 10),
          );
          const y =
            Math.round((index + offset - position) * atlas.lineHeight * ratio) /
            ratio;
          const visibleInk =
            Math.min(atlas.lineHeight, y + image.inkBottom) -
            Math.max(0, y + image.inkTop);
          // Skip subpixel ink slivers without changing the glyph color.
          if (visibleInk * ratio < 1) continue;
          context.drawImage(
            image.canvas,
            x + Math.round(((cell.width - image.advance) * ratio) / 2) / ratio,
            y,
            image.canvas.width / ratio,
            image.canvas.height / ratio,
          );
        }
      }
    }
    context.restore();
  }
  private syncClocks(next: Set<Clock>) {
    for (const clock of this.clocks) {
      if (!next.has(clock) && --clock.users === 0) clock.animation.cancel();
    }
    for (const clock of next) {
      if (!this.clocks.has(clock)) clock.users += 1;
    }
    this.clocks = next;
  }
  settle(preserveLayout?: boolean) {
    if (!preserveLayout) {
      this.cells = [];
      pending.delete(this);
      invalidateSurface(this.surface);
    }
    active.delete(this);
    this.syncClocks(new Set());
    this.clock = null;
    this.cells.forEach((cell) => {
      delete cell.rolls;
    });
    delete this.host.dataset.rollingReady;
    stopIdleFrame();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.settle();
    this.settings = null;
    this.allowed = false;
    this.stop();
    this.surface.motions.delete(this);
    if (!this.surface.motions.size) {
      this.surface.stopLayout();
      this.surface.canvas.remove();
      surfaces.delete(this.grid);
    }
  }
}
