// @tensorflow-models/pose-detection statically imports `Pose` from
// @mediapipe/pose for its BlazePose backend, but that package isn't a proper
// ESM/CJS module (it's built for a <script> tag global), which breaks Vite's
// production bundler with a MISSING_EXPORT error — even though we only use
// MoveNet and this code path never actually runs. Vite aliases the import to
// this stub (see vite.config.ts) so the bundler is satisfied without pulling
// in the real (large, WASM-based) BlazePose runtime we never use.
export class Pose {
  constructor() {
    throw new Error("BlazePose is not supported in this app — MoveNet is used instead.");
  }
}
