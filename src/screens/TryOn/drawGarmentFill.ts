import type { GarmentCentroid } from "./bodySegmentation";
import type { TshirtItem } from "./tshirts";

/**
 * Fills `ctx` with the selected tee's color/pattern across the whole canvas —
 * the caller then restricts this to the real garment mask (see CameraTryOn.tsx),
 * so stripes just need to be screen-space horizontal bands wide enough to be
 * cropped by whatever the mask's shape turns out to be; only the graphic
 * emblem needs to know roughly where the garment actually is.
 */
export function drawGarmentFill(
  ctx: CanvasRenderingContext2D,
  item: TshirtItem,
  width: number,
  height: number,
  centroid: GarmentCentroid | null,
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

  if (item.pattern === "graphic" && item.accent && centroid) {
    // sqrt(pixelCount) is a stable proxy for the garment's on-screen scale —
    // unlike a bounding box, it isn't dominated by a handful of stray
    // misclassified pixels (a few near the neck previously inflated a
    // bounding-box-derived circle to cover most of the face).
    const scale = Math.sqrt(centroid.pixelCount);
    const centerX = centroid.x;
    // The pixel-mean sits near the vertical middle of the whole torso+arms
    // region; a chest graphic reads better nudged up toward the upper chest.
    const centerY = centroid.y - scale * 0.22;
    const radius = scale * 0.14;
    ctx.fillStyle = item.accent;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
