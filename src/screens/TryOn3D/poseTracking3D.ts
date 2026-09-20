import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

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
