import type { GarmentBounds } from "./bodySegmentation";
import type { TshirtItem } from "./tshirts";

/**
 * Fills `ctx` with the selected tee's color/pattern across the whole canvas —
 * the caller then restricts this to the real garment mask (see CameraTryOn.tsx),
 * so only the exact bounds of the visible shirt need to be roughly right for
 * the graphic emblem; stripes just need to be screen-space horizontal bands
 * wide enough to be cropped by whatever the mask's shape turns out to be.
 */
export function drawGarmentFill(
  ctx: CanvasRenderingContext2D,
  item: TshirtItem,
  width: number,
  height: number,
  bounds: GarmentBounds | null,
): void {
  ctx.fillStyle = item.color;
  ctx.fillRect(0, 0, width, height);

  if (item.pattern === "striped" && item.accent) {
    ctx.fillStyle = item.accent;
    const stripeHeight = 26;
    const gap = 46;
    for (let y = 0; y < height; y += gap) {
      ctx.fillRect(0, y, width, stripeHeight);
    }
  }

  if (item.pattern === "graphic" && item.accent && bounds) {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = bounds.minY + (bounds.maxY - bounds.minY) * 0.35;
    const radius = (bounds.maxX - bounds.minX) * 0.22;
    ctx.fillStyle = item.accent;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
