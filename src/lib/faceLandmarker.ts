import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

// Lazy singleton, like poseLandmarker.ts. Returns 478 landmarks per face, including both irises.
// detectForVideo timestamps must increase across callers — use performance.now().
export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE_URL)
      .then((filesetResolver) =>
        FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        }),
      )
      .catch((error) => {
        landmarkerPromise = null;
        throw error;
      });
  }
  return landmarkerPromise;
}
