import type { GarmentCentroid } from "./bodySegmentation";
import type { TshirtItem } from "./tshirts";

/**
 * Fills `ctx` with the selected tee's flat color/pattern — no shading here.
 * Two earlier versions tried to fake the folds: one blended with the real
 * video's luminance (let the customer's actual shirt texture/pattern show
 * through no matter how much it was pre-blurred), the other hand-drew fixed
 * fold curves (looked artificial and didn't reflect what the shirt was
 * actually doing right now — the customer's real posture/creases). Real
 * lighting variation is instead derived from the actual video separately
 * (heavily blurred and fully desaturated first, so no color or fine
 * pattern survives — see CameraTryOn.tsx) and composited on top of this
 * flat fill with a lighten/darken-only blend mode. This file only needs to
 * get the color/pattern right; the caller owns how it's shaded.
 *
 * Stripes just need to be screen-space horizontal bands wide enough to be
 * cropped by whatever the mask's shape turns out to be. The graphic emblem
 * needs to know roughly where the garment actually is — `centroid` (a mean
 * over every masked pixel, plus its pixel count as a stable on-screen-scale
 * proxy) gives that without a bounding box's sensitivity to a few stray
 * misclassified pixels.
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
    const scale = Math.sqrt(centroid.pixelCount);
    const centerX = centroid.x;
    const centerY = centroid.y - scale * 0.05;
    const radius = scale * 0.14;
    ctx.fillStyle = item.accent;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
