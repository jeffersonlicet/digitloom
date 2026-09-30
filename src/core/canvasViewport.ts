/** @fileoverview Bounds backing pixels to the visible portion of a group. */
interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** Returns the viewport crop in group coordinates, including partially visible groups. */
export function canvasViewport(group: Rect, viewport: Rect) {
  const left = Math.max(0, viewport.left - group.left);
  const top = Math.max(0, viewport.top - group.top);
  return {
    left,
    top,
    width: Math.max(
      0,
      Math.min(group.width, viewport.left + viewport.width - group.left) - left,
    ),
    height: Math.max(
      0,
      Math.min(group.height, viewport.top + viewport.height - group.top) - top,
    ),
  };
}
