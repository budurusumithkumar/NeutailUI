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

const SEGMENTATION_CONFIG = {
  internalResolution: "medium",
  segmentationThreshold: 0.7,
  maxDetections: 1,
} as const;

export interface GarmentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GarmentSegmentation {
  found: boolean;
  bounds: GarmentBounds | null;
}

/**
 * Runs part segmentation and writes a torso/upper-arm alpha mask into
 * `maskCanvas` (opaque white where the garment region is, transparent
 * elsewhere) at the video's native resolution, plus that region's bounding
 * box (used to place pattern graphics sensibly). `found: false` means no
 * person was detected — the caller should keep showing the last good mask
 * briefly rather than clearing it on a single missed frame.
 */
export async function segmentGarmentMask(
  net: BodyPix,
  video: HTMLVideoElement,
  maskCanvas: HTMLCanvasElement,
): Promise<GarmentSegmentation> {
  const result = await net.segmentPersonParts(video, SEGMENTATION_CONFIG);
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return { found: false, bounds: null };

  maskCanvas.width = result.width;
  maskCanvas.height = result.height;

  const imageData = ctx.createImageData(result.width, result.height);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      const i = y * result.width + x;
      const isGarment = GARMENT_PART_IDS.has(result.data[i]);
      const offset = i * 4;
      imageData.data[offset] = 255;
      imageData.data[offset + 1] = 255;
      imageData.data[offset + 2] = 255;
      imageData.data[offset + 3] = isGarment ? 255 : 0;
      if (isGarment) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { found, bounds: found ? { minX, minY, maxX, maxY } : null };
}
