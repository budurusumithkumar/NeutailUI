import type { Keypoint, Pose, PoseDetector } from "@tensorflow-models/pose-detection";

// Lazily loads TensorFlow.js + the MoveNet pose model, so the ~2-3MB of extra
// JS (and its model weights, fetched from Google's model hosting at runtime —
// see https://storage.googleapis.com/tfjs-models, the library's own documented
// default) only ever loads for someone who actually opens the camera preview,
// not as part of the main app bundle. The type-only import above is erased at
// compile time, so it doesn't force an eager load either.
//
// This gives real (if approximate) body tracking: shoulder/hip keypoints drive
// where and how the shirt is drawn each frame (see drawShirtOnCanvas.ts),
// instead of a screen-fixed sticker. There is still no backend for this —
// everything runs in the browser, and no video/pose data leaves it.

export interface Point {
  x: number;
  y: number;
}

export interface TorsoPose {
  shoulderMid: Point;
  shoulderWidth: number;
  hipMid: Point | null;
  /** Radians; angle of the shoulder line, for rotating the shirt with body tilt. */
  angle: number;
}

let detectorPromise: Promise<PoseDetector> | null = null;

export function loadPoseDetector(): Promise<PoseDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const [tf, poseDetection] = await Promise.all([
        import("@tensorflow/tfjs"),
        import("@tensorflow-models/pose-detection"),
      ]);
      await tf.ready();
      return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      });
    })();
  }
  return detectorPromise;
}

const MIN_KEYPOINT_SCORE = 0.35;

function findKeypoint(keypoints: Keypoint[], name: string): Point | null {
  const point = keypoints.find((keypoint) => keypoint.name === name);
  if (!point || (point.score ?? 0) < MIN_KEYPOINT_SCORE) return null;
  return { x: point.x, y: point.y };
}

/** Extracts a torso pose from one MoveNet result, or null if shoulders aren't confidently visible. */
export function estimateTorso(pose: Pose): TorsoPose | null {
  const leftShoulder = findKeypoint(pose.keypoints, "left_shoulder");
  const rightShoulder = findKeypoint(pose.keypoints, "right_shoulder");
  if (!leftShoulder || !rightShoulder) return null;

  const leftHip = findKeypoint(pose.keypoints, "left_hip");
  const rightHip = findKeypoint(pose.keypoints, "right_hip");
  const hipMid =
    leftHip && rightHip
      ? { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
      : null;

  return {
    shoulderMid: {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    },
    shoulderWidth: Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y),
    hipMid,
    angle: Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x),
  };
}

const SMOOTHING = 0.35;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Exponential smoothing so the shirt glides between frames instead of jittering with raw per-frame noise. */
export function smoothTorso(previous: TorsoPose | null, next: TorsoPose | null): TorsoPose | null {
  if (!next) return null;
  if (!previous) return next;

  return {
    shoulderMid: {
      x: lerp(previous.shoulderMid.x, next.shoulderMid.x, SMOOTHING),
      y: lerp(previous.shoulderMid.y, next.shoulderMid.y, SMOOTHING),
    },
    shoulderWidth: lerp(previous.shoulderWidth, next.shoulderWidth, SMOOTHING),
    hipMid:
      next.hipMid && previous.hipMid
        ? {
            x: lerp(previous.hipMid.x, next.hipMid.x, SMOOTHING),
            y: lerp(previous.hipMid.y, next.hipMid.y, SMOOTHING),
          }
        : next.hipMid,
    angle: lerp(previous.angle, next.angle, SMOOTHING),
  };
}
