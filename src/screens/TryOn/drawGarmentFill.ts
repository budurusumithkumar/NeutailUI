import type { GarmentCentroid } from "./bodySegmentation";
import type { TshirtItem } from "./tshirts";

/**
 * Fills `ctx` with the selected tee's color/pattern and a *designed* fabric
 * look (a light-from-above gradient) — the caller then draws this, clipped
 * to the real garment mask, fully opaque over the
 * customer's actual shirt (see CameraTryOn.tsx), rather than blending with
 * the real video's pixels. An earlier version tried keeping the backdrop's
 * real luminance (via a "color" composite blend) so folds/shading would
 * look real, but that let the customer's *actual* shirt texture/pattern
 * show through no matter how much it was pre-blurred, and the blur strong
 * enough to hide a patterned shirt made plain ones look like a flat, pasted-
 * on patch. Full replacement removes that tension outright — nothing here
 * is derived from the live video, so nothing of the real garment can leak
 * through, and the designed shading is what has to carry all of the
 * "actually looks like fabric" work instead.
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
    // A previous version nudged this up by scale*0.22, assuming the mask
    // spanned the full torso+arms (so its centroid sat below the chest).
    // Once the mask's top edge started being cut off near the collar (see
    // bodySegmentation.ts), that same offset started overshooting past the
    // chest entirely and landed the emblem near the chin/neck. The mask's
    // centroid is now already close to chest-centered on its own, so this
    // only needs a small nudge, not a large one.
    const centerX = centroid.x;
    const centerY = centroid.y - scale * 0.05;
    const radius = scale * 0.14;
    ctx.fillStyle = item.accent;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Designed shading, not sampled from the video at all: light from above,
  // shadow pooling toward the bottom of the frame. The mask (applied by the
  // caller) crops this to wherever the real garment actually is, so it
  // doesn't need centroid/scale math of its own to line up correctly.
  const shading = ctx.createLinearGradient(0, 0, 0, height);
  shading.addColorStop(0, "rgba(255,255,255,0.22)");
  shading.addColorStop(0.3, "rgba(255,255,255,0.04)");
  shading.addColorStop(0.7, "rgba(0,0,0,0.08)");
  shading.addColorStop(1, "rgba(0,0,0,0.24)");
  ctx.fillStyle = shading;
  ctx.fillRect(0, 0, width, height);
}
