import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const MIN_VISIBILITY = 0.5;

// MediaPipe's standard 33-point pose landmark indices.
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

export interface Torso {
  leftShoulder: NormalizedLandmark;
  rightShoulder: NormalizedLandmark;
  leftHip: NormalizedLandmark;
  rightHip: NormalizedLandmark;
  /** Elbow positions, when confidently visible, used to widen the mesh for a raised/bent arm. */
  leftElbow: NormalizedLandmark | null;
  rightElbow: NormalizedLandmark | null;
}

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/**
 * Lazy singleton, mirroring the existing loadBodySegmenter() pattern in
 * ../TryOn/bodySegmentation.ts — the model is large enough that it should
 * only ever be loaded once per session, on first use.
 */
export function loadPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE_URL).then((filesetResolver) =>
      PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
    );
  }
  return landmarkerPromise;
}

function visible(landmark: NormalizedLandmark | undefined): landmark is NormalizedLandmark {
  return landmark !== undefined && landmark.visibility >= MIN_VISIBILITY;
}

/**
 * Pulls the torso landmarks needed to drive the shirt mesh out of a raw
 * PoseLandmarker result. Returns null when the shoulders/hips aren't
 * confidently visible — the caller should hold the last good frame rather
 * than snap the mesh to a low-confidence guess.
 */
export function extractTorso(landmarks: NormalizedLandmark[]): Torso | null {
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const leftHip = landmarks[LEFT_HIP];
  const rightHip = landmarks[RIGHT_HIP];

  if (!visible(leftShoulder) || !visible(rightShoulder) || !visible(leftHip) || !visible(rightHip)) {
    return null;
  }

  const leftElbow = landmarks[LEFT_ELBOW];
  const rightElbow = landmarks[RIGHT_ELBOW];

  return {
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftElbow: visible(leftElbow) ? leftElbow : null,
    rightElbow: visible(rightElbow) ? rightElbow : null,
  };
}
