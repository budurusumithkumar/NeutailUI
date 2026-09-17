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
      return bodyPix.load({
        architecture: "MobileNetV1",
        outputStride: 16,
        multiplier: 0.75,
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

// How far below the detected face's bottom edge (in multiples of the face's
// own height) to still allow before cutting the mask off — covers the neck
// itself before the collar starts. Tuned as a starting heuristic; there's no
// hard measurement backing this, so it may need another pass.
const NECK_ALLOWANCE_FACTOR = 0.5;

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
 * that the mask visibly bled up onto the face and blurred it. An earlier
 * version tried cutting the mask off at the pose-estimated shoulder line,
 * but that had no visible effect in practice — the bundled pose estimator
 * likely isn't detecting shoulders confidently enough for it to engage.
 *
 * This instead uses the *face* pixels from the same part-segmentation pass
 * (they're evidently reliable — the face itself never renders recolored)
 * to find where the face actually ends, and cuts the mask off a bit below
 * that (allowing room for the neck itself), regardless of what the torso
 * part label says above that line.
 *
 * The centroid — a mean over every remaining garment pixel — is used
 * instead of a bounding box for graphic placement because a bounding box
 * is dominated by whichever single pixel is furthest out. `found: false`
 * means no person was detected — the caller should keep showing the last
 * good mask briefly rather than clearing it on a missed frame.
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

  let faceMinY = Infinity;
  let faceMaxY = -Infinity;
  for (let i = 0; i < result.data.length; i++) {
    if (FACE_PART_IDS.has(result.data[i])) {
      const y = Math.floor(i / result.width);
      if (y < faceMinY) faceMinY = y;
      if (y > faceMaxY) faceMaxY = y;
    }
  }
  const cutoffY =
    faceMaxY > -Infinity ? faceMaxY + (faceMaxY - faceMinY) * NECK_ALLOWANCE_FACTOR : -Infinity;

  const imageData = ctx.createImageData(result.width, result.height);
  let sumX = 0;
  let sumY = 0;
  let pixelCount = 0;

  for (let y = 0; y < result.height; y++) {
    const aboveCutoff = y < cutoffY;
    for (let x = 0; x < result.width; x++) {
      const i = y * result.width + x;
      const isGarment = !aboveCutoff && GARMENT_PART_IDS.has(result.data[i]);
      const offset = i * 4;
      imageData.data[offset] = 255;
      imageData.data[offset + 1] = 255;
      imageData.data[offset + 2] = 255;
      imageData.data[offset + 3] = isGarment ? 255 : 0;
      if (isGarment) {
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
