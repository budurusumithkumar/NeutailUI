import { WORN_SHIRT_PATH } from "./shirtPaths";
import type { TshirtItem } from "./tshirts";
import type { TorsoPose } from "./poseTracking";

// Geometry of WORN_SHIRT_PATH in its own local coordinate space (see shirtPaths.ts):
// shoulder seam runs from (48,58) to (112,58), hem runs across y=182.
const PATH_SHOULDER_SPAN = 112 - 48;
const PATH_TORSO_SPAN = 182 - 58;
// MoveNet's shoulder keypoint sits at the joint (roughly armpit height), noticeably
// below and narrower than the actual fabric shoulder/collar line — confirmed against
// a real photo, where the tracked shirt rendered too low and too narrow, real
// shoulders visibly peeking out past both edges. COLLAR_LIFT nudges the anchor
// down in local space (which shifts the rendered garment UP relative to the
// tracked joint — see the comment in drawShirtOnCanvas below) to compensate.
const COLLAR_LIFT = 16;
const ANCHOR = { x: (48 + 112) / 2, y: 58 + COLLAR_LIFT };

const SHOULDER_FIT_FACTOR = 1.55; // shirt is meaningfully wider than the tracked joint-to-joint distance
const TORSO_FIT_FACTOR = 1.1; // hem falls a little past the tracked hip line
const FALLBACK_TORSO_RATIO = 1.55; // used when hips aren't visible in frame

const shirtPath = new Path2D(WORN_SHIRT_PATH);

/**
 * Draws one tee, warped to the tracked shoulder position/width/rotation (and hip
 * position when visible), onto a 2D canvas already holding the mirrored video
 * frame. This is a flat-shaded illustration warped by 2D pose keypoints, not a
 * physically simulated garment — there is no 3D body model or cloth simulation
 * here — but the shading pass below is what keeps it from reading as a flat sticker.
 */
export function drawShirtOnCanvas(
  ctx: CanvasRenderingContext2D,
  torso: TorsoPose,
  item: TshirtItem,
  sizeAdjust: number,
): void {
  const torsoHeight = torso.hipMid
    ? Math.hypot(torso.hipMid.x - torso.shoulderMid.x, torso.hipMid.y - torso.shoulderMid.y)
    : torso.shoulderWidth * FALLBACK_TORSO_RATIO;

  const scaleX = (torso.shoulderWidth * SHOULDER_FIT_FACTOR * sizeAdjust) / PATH_SHOULDER_SPAN;
  const scaleY = (torsoHeight * TORSO_FIT_FACTOR * sizeAdjust) / PATH_TORSO_SPAN;

  ctx.save();
  ctx.translate(torso.shoulderMid.x, torso.shoulderMid.y);
  ctx.rotate(torso.angle);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-ANCHOR.x, -ANCHOR.y);

  ctx.fillStyle = item.color;
  ctx.fill(shirtPath);

  if (item.pattern === "striped" && item.accent) {
    ctx.save();
    ctx.clip(shirtPath);
    ctx.fillStyle = item.accent;
    for (const fraction of [0.34, 0.56, 0.78]) {
      ctx.fillRect(0, 40 + PATH_TORSO_SPAN * fraction, 160, PATH_TORSO_SPAN * 0.09);
    }
    ctx.restore();
  }

  if (item.pattern === "graphic" && item.accent) {
    ctx.save();
    ctx.clip(shirtPath);
    ctx.fillStyle = item.accent;
    ctx.beginPath();
    ctx.arc(80, 58 + PATH_TORSO_SPAN * 0.32, PATH_SHOULDER_SPAN * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Fabric shading: light from above, shadow pooling toward the hem, plus a
  // couple of soft vertical folds — what actually sells "worn cloth" over flat art.
  ctx.save();
  ctx.clip(shirtPath);

  const shading = ctx.createLinearGradient(0, 40, 0, 40 + PATH_TORSO_SPAN * 1.3);
  shading.addColorStop(0, "rgba(255,255,255,0.24)");
  shading.addColorStop(0.3, "rgba(255,255,255,0.05)");
  shading.addColorStop(0.75, "rgba(0,0,0,0.08)");
  shading.addColorStop(1, "rgba(0,0,0,0.24)");
  ctx.fillStyle = shading;
  ctx.fillRect(0, 0, 160, 220);

  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 3;
  for (const foldX of [58, 80, 102]) {
    ctx.beginPath();
    ctx.moveTo(foldX, 75);
    ctx.quadraticCurveTo(foldX + 2, 120, foldX, 172);
    ctx.stroke();
  }
  ctx.restore();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.stroke(shirtPath);

  ctx.restore();
}
