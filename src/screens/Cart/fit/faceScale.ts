// Real-world scale from the user's own face, so no height (or anything else) has to be typed in.
// Two near-constant human measurements are used as rulers: the iris diameter (~11.7 mm, varies
// only a few % between adults — the same constant MediaPipe's iris depth estimate uses) and the
// face width between the cheek-contour landmarks (~14 cm, varies ~5% and by sex). The estimated
// camera distance also lets us correct for the torso sitting further back than the face.

export interface Pt {
  x: number;
  y: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export const IRIS_DIAMETER_CM = 1.17;
// The cheek-contour landmarks sit inside the widest part of the face; one real frame read ~12.7 cm by the
// iris ruler, so 13.2 rather than the ~14 cm of full bizygomatic width. Iris is the more reliable ruler.
export const FACE_WIDTH_CM = 13.2;

// Webcams vary (roughly 60–80° horizontal); only used to turn scale into an approximate distance.
export const ASSUMED_HORIZONTAL_FOV_DEG = 65;
// How much further from the camera these planes are than the cheek plane, in a front view: the cheeks sit
// ~5–7 cm ahead of the shoulder joints even in good posture, more when the head is forward (seated at a
// laptop), so a real close-up (0.5 m) needs more correction than a small offset gives.
export const SHOULDER_PLANE_OFFSET_CM = 9;
export const TORSO_PLANE_OFFSET_CM = 10;

const MIN_IRIS_PX = 5;
const MAX_IRIS_FACE_DISAGREEMENT = 0.25; // ln-ratio; beyond this the iris reading is distrusted
const MAX_YAW_OFFSET = 0.08;
export const MAX_DISTANCE_CM = 350;

const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const NOSE_TIP = 1;
const LEFT_IRIS = [469, 470, 471, 472];
const RIGHT_IRIS = [474, 475, 476, 477];

function dist(a: Pt, b: Pt, video: Size2D): number {
  return Math.hypot((a.x - b.x) * video.width, (a.y - b.y) * video.height);
}

function irisDiameterPx(landmarks: Pt[], ring: number[], video: Size2D): number {
  // The two opposite-pair spans; the larger is the un-occluded (horizontal) one.
  return Math.max(dist(landmarks[ring[0]], landmarks[ring[2]], video), dist(landmarks[ring[1]], landmarks[ring[3]], video));
}

export interface FaceMetrics {
  facePx: number;
  irisPx: number | null;
  /** Nose offset from the cheek midpoint as a fraction of face width; ~0 when facing the camera. */
  yawOffset: number;
}

export function faceMetrics(landmarks: Pt[], video: Size2D): FaceMetrics | null {
  if (landmarks.length < 468) return null;
  const left = landmarks[LEFT_CHEEK];
  const right = landmarks[RIGHT_CHEEK];
  const facePx = dist(left, right, video);
  if (facePx <= 0) return null;
  const yawOffset = (landmarks[NOSE_TIP].x - (left.x + right.x) / 2) * video.width / facePx;
  const irisPx =
    landmarks.length >= 478
      ? (irisDiameterPx(landmarks, LEFT_IRIS, video) + irisDiameterPx(landmarks, RIGHT_IRIS, video)) / 2
      : null;
  return { facePx, irisPx, yawOffset };
}

export function isFacingCamera(metrics: FaceMetrics): boolean {
  return Math.abs(metrics.yawOffset) <= MAX_YAW_OFFSET;
}

/** cm per video pixel at the face plane. */
export function faceCmPerPx(metrics: FaceMetrics): number {
  const fromFace = FACE_WIDTH_CM / metrics.facePx;
  if (metrics.irisPx === null || metrics.irisPx < MIN_IRIS_PX) return fromFace;
  const fromIris = IRIS_DIAMETER_CM / metrics.irisPx;
  if (Math.abs(Math.log(fromIris / fromFace)) > MAX_IRIS_FACE_DISAGREEMENT) return fromFace;
  // Trust the iris more the more pixels it covers (its pixel noise shrinks as it gets bigger).
  const irisWeight = 0.3 + 0.5 * Math.min(1, Math.max(0, (metrics.irisPx - MIN_IRIS_PX) / 10));
  return Math.exp(irisWeight * Math.log(fromIris) + (1 - irisWeight) * Math.log(fromFace));
}

function focalLengthPx(video: Size2D): number {
  return video.width / 2 / Math.tan((ASSUMED_HORIZONTAL_FOV_DEG * Math.PI) / 360);
}

/** Approximate camera-to-face distance implied by the face's apparent size. */
export function distanceCm(faceScale: number, video: Size2D): number {
  return focalLengthPx(video) * faceScale;
}

/** cm per video pixel on a plane `offsetCm` further from the camera than the face: further things cover more cm per pixel. */
export function planeCmPerPx(faceScale: number, video: Size2D, offsetCm: number): number {
  return faceScale * (1 + offsetCm / distanceCm(faceScale, video));
}
