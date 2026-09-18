import type { BodyPix } from "@tensorflow-models/body-pix";

// Lazily loads TensorFlow.js + BodyPix (dynamic import, so this only downloads
// when a customer actually opens the camera — see loadBodySegmenter). Segments
// which pixels belong to the torso/upper-arms so CameraTryOn can recolor the
// customer's *actual* clothing to the selected tee (see drawGarmentFill.ts and
// CameraTryOn.tsx), instead of warping a synthetic shape over their body —
// keeping their real folds, shading, and fit is the whole point.

let netPromise: Promise<BodyPix> | null = null;

export function loadBodySegmenter(): Promise<BodyPix> {
  if (!netPromise) {
    netPromise = (async () => {
      const [tf, bodyPix] = await Promise.all([
        import("@tensorflow/tfjs"),
        import("@tensorflow-models/body-pix"),
      ]);
      await tf.ready();
      // ResNet50 instead of MobileNetV1: several real-world tests showed the
      // torso/face part boundary itself misclassifying a large, contiguous
      // chunk of neck/chin as torso — not just a few edge pixels — which no
      // amount of post-hoc cutoff math can fully correct if the underlying
      // labels are wrong over a wide area. ResNet50 is BodyPix's more
      // accurate (but slower, larger-download) architecture; worth the
      // tradeoff since this loads once per session and runs on a throttled
      // detection interval, not every render frame.
      return bodyPix.load({
        architecture: "ResNet50",
        outputStride: 32,
        quantBytes: 2,
      });
    })();
  }
  return netPromise;
}

// Indices into body-pix's PART_CHANNELS covering a typical T-shirt's coverage:
// torso front/back + upper arms front/back (short-sleeve length) on both sides.
// (left_upper_arm_front=2, left_upper_arm_back=3, right_upper_arm_front=4,
// right_upper_arm_back=5, torso_front=12, torso_back=13.)
const GARMENT_PART_IDS = new Set([2, 3, 4, 5, 12, 13]);
// left_face=0, right_face=1.
const FACE_PART_IDS = new Set([0, 1]);

const SEGMENTATION_CONFIG = {
  internalResolution: "medium",
  segmentationThreshold: 0.7,
  maxDetections: 1,
} as const;

// The face's linear size is approximated as sqrt(pixelCount) (see the same
// reasoning on GarmentCentroid below) — never a min/max over raw pixels,
// which a single stray pixel anywhere (a hand mistaken for skin, say) can
// drag arbitrarily far. FACE_TO_COLLAR_FACTOR estimates the total distance
// from the face's own centroid down to where the collar legitimately starts.
// A first attempt combined two factors totaling 1.1 and badly overshot,
// cutting off almost the entire torso. The second (0.55, with ResNet50's
// more accurate part boundary doing more of the work) was closer but still
// clipped real shoulder-width torso pixels at the sides, visible as an
// uneven notch and untouched collar fabric — because a real collar/neckline
// isn't a flat horizontal line, so any single cutoff calibrated for the
// lowest point (the center, above the neck) inevitably cuts too much at the
// higher points (the shoulders). Lower still, and — combined with
// TRANSITION_BAND below — softer at the boundary, so a residual mismatch
// blends rather than showing as a hard edge.
const FACE_TO_COLLAR_FACTOR = 0.35;
// Width (in the same sqrt(facePixelCount) units) of the soft fade around the
// cutoff line, instead of an abrupt on/off step — a harsh edge is what makes
// any remaining miscalibration look broken rather than merely imperfect.
const TRANSITION_BAND_FACTOR = 0.3;

export interface GarmentCentroid {
  x: number;
  y: number;
  /** Count of garment pixels — sqrt(pixelCount) is a stable size proxy for
   * placing pattern graphics, since it scales smoothly with how much of the
   * frame the garment fills (closer/farther) without a bounding box's
   * sensitivity to a few stray misclassified pixels. */
  pixelCount: number;
}

export interface GarmentSegmentation {
  found: boolean;
  centroid: GarmentCentroid | null;
}

/**
 * Runs part segmentation and writes a torso/upper-arm alpha mask into
 * `maskCanvas` (opaque white where the garment region is, transparent
 * elsewhere) at the video's native resolution, plus that region's centroid
 * (used to place pattern graphics).
 *
 * The raw part-segmentation boundary alone isn't reliable at close webcam
 * range: pixels near the neck/chin get misclassified as torso often enough
 * that the mask visibly bled up onto the face and blurred it. This cuts the
 * mask off using the *face* pixels from the same part-segmentation pass —
 * found where the face's mean position is, sized by how many pixels it
 * covers — rather than trusting the torso part label near that boundary.
 *
 * Every measurement here (garment centroid, face centroid, both pixel
 * counts) is a sum over every matching pixel, deliberately never a raw
 * min/max: an early version used the single lowest face-labeled pixel as
 * the cutoff reference and one stray pixel (a hand raised into frame,
 * mistaken for skin) dragged that cutoff down across most of the shirt.
 * A mean is barely moved by a handful of outliers; that's the whole reason
 * to use one here.
 */
export async function segmentGarmentMask(
  net: BodyPix,
  video: HTMLVideoElement,
  maskCanvas: HTMLCanvasElement,
): Promise<GarmentSegmentation> {
  const result = await net.segmentPersonParts(video, SEGMENTATION_CONFIG);
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return { found: false, centroid: null };

  maskCanvas.width = result.width;
  maskCanvas.height = result.height;

  let faceSumY = 0;
  let facePixelCount = 0;
  for (let i = 0; i < result.data.length; i++) {
    if (FACE_PART_IDS.has(result.data[i])) {
      faceSumY += Math.floor(i / result.width);
      facePixelCount++;
    }
  }
  const faceScale = facePixelCount > 0 ? Math.sqrt(facePixelCount) : 0;
  const cutoffY = facePixelCount > 0 ? faceSumY / facePixelCount + faceScale * FACE_TO_COLLAR_FACTOR : -Infinity;
  const transitionBand = faceScale * TRANSITION_BAND_FACTOR;

  const imageData = ctx.createImageData(result.width, result.height);
  let sumX = 0;
  let sumY = 0;
  let pixelCount = 0;

  for (let y = 0; y < result.height; y++) {
    // A hard step here is what turns any leftover calibration error into a
    // visible edge (or worse, a notch, since a real neckline isn't flat) —
    // fading over `transitionBand` around the cutoff blends it instead.
    let fadeAlpha = 1;
    if (transitionBand > 0) {
      if (y < cutoffY - transitionBand) fadeAlpha = 0;
      else if (y < cutoffY + transitionBand) fadeAlpha = (y - (cutoffY - transitionBand)) / (2 * transitionBand);
    }
    for (let x = 0; x < result.width; x++) {
      const i = y * result.width + x;
      const isGarmentPart = GARMENT_PART_IDS.has(result.data[i]);
      const alpha = isGarmentPart ? Math.round(fadeAlpha * 255) : 0;
      const offset = i * 4;
      imageData.data[offset] = 255;
      imageData.data[offset + 1] = 255;
      imageData.data[offset + 2] = 255;
      imageData.data[offset + 3] = alpha;
      if (alpha > 0) {
        sumX += x;
        sumY += y;
        pixelCount++;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  if (pixelCount === 0) return { found: false, centroid: null };

  return {
    found: true,
    centroid: { x: sumX / pixelCount, y: sumY / pixelCount, pixelCount },
  };
}
