import type { GarmentCentroid } from "./bodySegmentation";
import type { TshirtItem } from "./tshirts";

/**
 * Fills `ctx` with the selected tee's color/pattern plus a *generic* ambient
 * shading — never a specific fold shape. Two earlier versions tried that:
 * one blended with the real video's luminance (let the customer's actual
 * shirt texture/pattern show through no matter how much it was pre-
 * blurred), the other hand-drew fixed fold curves (looked artificial and
 * didn't reflect the customer's real posture/creases at that moment). A
 * third version dropped all baseline shading and relied entirely on a
 * real, video-derived lighting overlay (see CameraTryOn.tsx) — but a still,
 * relatively flat pose can genuinely have little real fold detail to pick
 * up, so it read as flat again, just for a different reason: there's no
 * fold to manufacture from a live feed at a moment when the real shirt
 * isn't visibly folding.
 *
 * The ambient shading here (light from above, and a bright-center/shadowed-
 * edge sweep simulating the torso curving toward the viewer) is deliberately
 * generic rather than any specific fold — a smooth ambient cue can't be
 * "wrong" the way a hand-drawn fold's exact position/shape can, so it's a
 * safe permanent baseline. The real lighting overlay still layers on top of
 * this for authentic, responsive fold detail when the shirt is actually
 * folding.
 *
 * Stripes just need to be screen-space horizontal bands wide enough to be
 * cropped by whatever the mask's shape turns out to be. The graphic emblem
 * and the horizontal sweep need to know roughly where the garment actually
 * is — `centroid` (a mean over every masked pixel, plus its pixel count as
 * a stable on-screen-scale proxy) gives that without a bounding box's
 * sensitivity to a few stray misclassified pixels.
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

  if (item.pattern === "zigzag" && item.accent) {
    ctx.strokeStyle = item.accent;
    ctx.lineWidth = 6;
    const amplitude = 14;
    const period = 28;
    const rowGap = 40;
    for (let y = 30; y < height; y += rowGap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      let up = true;
      for (let x = period / 2; x < width + period; x += period / 2) {
        ctx.lineTo(x, up ? y - amplitude : y + amplitude);
        up = !up;
      }
      ctx.stroke();
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

  const vertical = ctx.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, "rgba(255,255,255,0.14)");
  vertical.addColorStop(0.35, "rgba(255,255,255,0.02)");
  vertical.addColorStop(0.7, "rgba(0,0,0,0.05)");
  vertical.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, width, height);

  if (centroid) {
    const scale = Math.sqrt(centroid.pixelCount);
    const horizontal = ctx.createLinearGradient(centroid.x - scale * 0.8, 0, centroid.x + scale * 0.8, 0);
    horizontal.addColorStop(0, "rgba(0,0,0,0.12)");
    horizontal.addColorStop(0.5, "rgba(255,255,255,0.08)");
    horizontal.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = horizontal;
    ctx.fillRect(0, 0, width, height);
  }
}
