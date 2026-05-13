// Focal-point math shared by the admin editor (drag interactions → x/y
// percentages) and storefront renderers (object-position / background-position).
//
// Percentages match CSS `object-position`: 0% = align image's left/top edge
// with container's left/top edge; 100% = align right/bottom edge.

export type FocalPoint = { x: number; y: number };

export const DEFAULT_FOCAL: FocalPoint = { x: 50, y: 50 };

export function clampFocal(p: { x: number; y: number }): FocalPoint {
  return {
    x: Math.max(0, Math.min(100, Number.isFinite(p.x) ? p.x : 50)),
    y: Math.max(0, Math.min(100, Number.isFinite(p.y) ? p.y : 50)),
  };
}

/** CSS string ready to drop into `object-position` / `background-position`. */
export function focalToCss(p: { x: number; y: number } | undefined | null): string {
  const f = clampFocal(p ?? DEFAULT_FOCAL);
  return `${f.x}% ${f.y}%`;
}

/**
 * Convert a drag (mouse delta) on an image preview into a new focal point.
 *
 * - `containerW/H` is the visible crop area (admin preview at destination ratio).
 * - `imageW/H` is the image's natural dimensions.
 * - `current` is the focal point before the drag started.
 * - `deltaPxX/Y` is the mouse movement (positive = right/down).
 *
 * The image is assumed to be `object-fit: cover` inside the container. Moving
 * the image up/left is equivalent to increasing focalY/X (focal point shifts
 * deeper into the image).
 */
export function focalFromDrag(args: {
  containerW: number;
  containerH: number;
  imageW: number;
  imageH: number;
  current: FocalPoint;
  deltaPxX: number;
  deltaPxY: number;
}): FocalPoint {
  const { containerW, containerH, imageW, imageH, current, deltaPxX, deltaPxY } = args;
  if (imageW <= 0 || imageH <= 0 || containerW <= 0 || containerH <= 0) {
    return clampFocal(current);
  }
  const scale = Math.max(containerW / imageW, containerH / imageH);
  const displayedW = imageW * scale;
  const displayedH = imageH * scale;
  const overflowX = Math.max(0, displayedW - containerW);
  const overflowY = Math.max(0, displayedH - containerH);
  // Dragging the image right increases its left edge → the focal point on the
  // image moves left (smaller X%). So the delta sign is inverted.
  const dx = overflowX > 0 ? (-deltaPxX / overflowX) * 100 : 0;
  const dy = overflowY > 0 ? (-deltaPxY / overflowY) * 100 : 0;
  return clampFocal({ x: current.x + dx, y: current.y + dy });
}
