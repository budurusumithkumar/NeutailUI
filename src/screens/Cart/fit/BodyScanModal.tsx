import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Button } from "../../../components/Button";
import { loadFaceLandmarker } from "../../../lib/faceLandmarker";
import { loadPoseLandmarker } from "../../../lib/poseLandmarker";
import { shoulderSample, torsoSample, type OverlayRun } from "./bodyGeometry";
import { CalibrationPanel } from "./CalibrationPanel";
import { isCalibrationMode } from "./calibration";
import { useBodyProfileStore } from "./bodyProfileStore";
import {
  MAX_DISTANCE_CM,
  SHOULDER_PLANE_OFFSET_CM,
  TORSO_PLANE_OFFSET_CM,
  distanceCm,
  faceCmPerPx,
  faceMetrics,
  isFacingCamera,
  planeCmPerPx,
} from "./faceScale";
import { measurementFromScan, median, relativeSpread, type BodyMeasurement } from "./sizing";

type Phase = "starting" | "scanning" | "result" | "denied" | "error";

const DETECTION_INTERVAL_MS = 50;
// Readings are judged over a sliding window of the latest ones, so what you did while still settling
// into position can't hold the scan back.
const WINDOW = 25;
const MAX_SPREAD = 0.12;
// Real webcam noise can keep the readings from ever agreeing tightly; after this long, accept the
// median of the latest window anyway (the result still shows how steady it was).
const HARD_ACCEPT_MS = 12000;
const SCALE_SMOOTHING_FRAMES = 15;
// Ignore frames while the face is growing/shrinking (walking towards or away from the camera):
// the smoothed scale lags behind, which would inflate or shrink the measurement.
const MAX_FACE_SIZE_DRIFT = 0.04;
const MIN_FRAMES_FOR_DRIFT = 6;
const INVALID_RESET_MS = 1200;
const MIN_FACE_PX = 40;
// A sampled band shorter than this (cm below the shoulders) can't reach the belly.
const PARTIAL_CHEST_BELOW_CM = 30;


const DEFAULT_GUIDANCE =
  "Sit comfortably facing the camera with both shoulders fully in the frame and your hands resting on your hips, elbows out.";

const MIN_GAUGE_CM = 30;
const MAX_GAUGE_CM = 150;
const gaugePct = (cm: number) => Math.min(100, Math.max(0, ((cm - MIN_GAUGE_CM) / (MAX_GAUGE_CM - MIN_GAUGE_CM)) * 100));

type CheckState = "ok" | "fail" | "wait";
interface Checks {
  face: CheckState;
  shoulders: CheckState;
  chest: CheckState;
  arms: CheckState;
}
const NO_CHECKS: Checks = { face: "wait", shoulders: "wait", chest: "wait", arms: "wait" };

interface Tick {
  checks: Checks;
  shoulder: number | null;
  torso: number | null;
  torsoReachCm: number | null;
  /** Something stops the reading from counting at all. */
  blocking: string | null;
  /** Reading counts, but could be better. */
  hint: string | null;
  /** Current camera-to-face distance, and — when the chest is out of frame — the distance that would show it. */
  distanceCm: number | null;
  targetCm: number | null;
  facePx: number | null;
  irisPx: number | null;
  jointCm: number | null;
  diagnostics: string;
  runs: OverlayRun[];
  frame: { width: number; height: number };
}

// A picture of the frame the size came from, with what was measured drawn on it, so the user can see
// whether the outline is right. Kept in memory only, never uploaded.
function makeSnapshot(video: HTMLVideoElement, tick: Tick, note: string): string | null {
  if (!video.videoWidth) return null;
  const scale = Math.min(1, 720 / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Mirrored, like the live preview.
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(74,222,128,0.95)";
  ctx.lineWidth = 2;
  const sx = canvas.width / tick.frame.width;
  const sy = canvas.height / tick.frame.height;
  for (const run of tick.runs) {
    ctx.beginPath();
    ctx.moveTo(run.left * sx, run.y * sy);
    ctx.lineTo((run.right + 1) * sx, run.y * sy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
  ctx.fillStyle = "white";
  ctx.font = "13px sans-serif";
  ctx.fillText(tick.diagnostics, 8, canvas.height - 26);
  ctx.fillText(note, 8, canvas.height - 8);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function BodyScanModal({ onClose }: { onClose: () => void }) {
  const setMeasurement = useBodyProfileStore((state) => state.setMeasurement);
  const [calibrating] = useState(isCalibrationMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [scanId, setScanId] = useState(1);
  const [phase, setPhase] = useState<Phase>("starting");
  const [guidance, setGuidance] = useState(DEFAULT_GUIDANCE);
  const [diagnostics, setDiagnostics] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BodyMeasurement | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [checks, setChecks] = useState<Checks>(NO_CHECKS);
  const [gauge, setGauge] = useState<{ distanceCm: number; targetCm: number } | null>(null);
  const [errorDetail, setErrorDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let pose: PoseLandmarker | null = null;
    let rafId = 0;

    function stopCamera() {
      stream?.getTracks().forEach((track) => track.stop());
    }

    function fail(error: unknown) {
      console.error("Body scan failed", error);
      if (cancelled) return;
      cancelled = true;
      stopCamera();
      setErrorDetail(error instanceof Error ? error.message : String(error));
      setPhase("error");
    }

    function drawOverlay(runs: OverlayRun[], frame: { width: number; height: number }) {
      const canvas = overlayRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !video || !ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(74,222,128,0.95)";
      ctx.lineWidth = Math.max(2, canvas.width / 320);
      const sx = canvas.width / frame.width;
      const sy = canvas.height / frame.height;
      for (const run of runs) {
        ctx.beginPath();
        ctx.moveTo(run.left * sx, run.y * sy);
        ctx.lineTo((run.right + 1) * sx, run.y * sy);
        ctx.stroke();
      }
    }

    // One detection pass: face for real-world scale, pose + person mask for shoulders and torso.
    function measure(
      face: FaceLandmarker,
      body: PoseLandmarker,
      video: HTMLVideoElement,
      time: number,
      history: { scales: number[]; faceSizes: number[] },
    ): Tick {
      const videoSize = { width: video.videoWidth, height: video.videoHeight };
      const base: Tick = {
        shoulder: null,
        torso: null,
        torsoReachCm: null,
        checks: { ...NO_CHECKS },
        blocking: null,
        hint: null,
        distanceCm: null,
        targetCm: null,
        facePx: null,
        irisPx: null,
        jointCm: null,
        diagnostics: "",
        runs: [],
        frame: videoSize,
      };

      const faceResult = face.detectForVideo(video, time);
      const metrics = faceResult.faceLandmarks[0] ? faceMetrics(faceResult.faceLandmarks[0], videoSize) : null;
      if (!metrics) {
        return { ...base, checks: { ...NO_CHECKS, face: "fail" }, blocking: "We can't see your face — look at the camera.", diagnostics: "face: not found" };
      }
      // The iris and cheek readings jitter frame to frame; a short running median steadies the scale.
      const { scales, faceSizes } = history;
      scales.push(faceCmPerPx(metrics));
      faceSizes.push(metrics.facePx);
      if (scales.length > SCALE_SMOOTHING_FRAMES) scales.shift();
      if (faceSizes.length > SCALE_SMOOTHING_FRAMES) faceSizes.shift();
      const faceScale = median(scales);
      const distance = distanceCm(faceScale, videoSize);
      base.distanceCm = distance;
      base.facePx = metrics.facePx;
      base.irisPx = metrics.irisPx;
      base.diagnostics = `distance ≈ ${(distance / 100).toFixed(1)} m · face ${Math.round(metrics.facePx)} px · iris ${
        metrics.irisPx === null ? "n/a" : `${metrics.irisPx.toFixed(1)} px`
      }`;
      const faceFail = { ...NO_CHECKS, face: "fail" as const };
      if (!isFacingCamera(metrics)) return { ...base, checks: faceFail, blocking: "Look straight at the camera." };
      if (faceSizes.length >= MIN_FRAMES_FOR_DRIFT && Math.abs(metrics.facePx / median(faceSizes) - 1) > MAX_FACE_SIZE_DRIFT) {
        return { ...base, checks: faceFail, blocking: "Hold still — you're moving towards or away from the camera." };
      }
      if (metrics.facePx < MIN_FACE_PX || distance > MAX_DISTANCE_CM) {
        return { ...base, checks: faceFail, blocking: "Move a little closer to the camera." };
      }

      const poseResult = body.detectForVideo(video, time);
      try {
        const m = poseResult.segmentationMasks?.[0];
        base.checks.face = "ok";
        if (!m) return { ...base, blocking: "Preparing body tracking…" };
        const mask = { width: m.width, height: m.height, data: m.getAsFloat32Array() };
        const frame = { width: mask.width, height: mask.height };
        const pose = poseResult.landmarks[0];

        const shoulders = shoulderSample(mask, pose, planeCmPerPx(faceScale, videoSize, SHOULDER_PLANE_OFFSET_CM), videoSize);
        if (!shoulders.ok) return { ...base, frame, checks: { ...base.checks, shoulders: "fail" }, blocking: shoulders.message };

        const torso = torsoSample(
          mask,
          pose,
          planeCmPerPx(faceScale, videoSize, TORSO_PLANE_OFFSET_CM),
          videoSize,
          shoulders.shoulderWidthCm,
        );
        const tick: Tick = {
          ...base,
          frame,
          shoulder: shoulders.shoulderWidthCm,
          jointCm: shoulders.jointDistanceCm,
          runs: shoulders.runs,
          checks: { ...base.checks, shoulders: "ok" },
        };
        tick.diagnostics += ` · shoulders ${shoulders.shoulderWidthCm.toFixed(0)} cm (joints ${shoulders.jointDistanceCm.toFixed(0)})`;
        if (torso.ok) {
          tick.torso = torso.torsoWidthCm;
          tick.torsoReachCm = torso.reachCm;
          tick.checks = { ...tick.checks, chest: "ok", arms: "ok" };
          tick.runs = [...tick.runs, ...torso.runs];
          tick.diagnostics += ` · torso ${torso.torsoWidthCm.toFixed(0)} cm`;
        } else if (torso.moveBackFactor) {
          tick.targetCm = distance * torso.moveBackFactor * 1.05;
          tick.checks = { ...tick.checks, chest: "fail" };
        } else {
          tick.hint = torso.message;
          if (torso.detail) tick.diagnostics += ` · ${torso.detail}`;
          tick.checks = { ...tick.checks, chest: "ok", arms: torso.reason === "arms" ? "fail" : "wait" };
        }
        return tick;
      } finally {
        poseResult.close();
      }
    }

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        if (!cancelled) setPhase("denied");
        return;
      }
      const video = videoRef.current;
      if (cancelled || !video) return;
      video.srcObject = stream;
      await video.play();

      const [face, body] = await Promise.all([loadFaceLandmarker(), loadPoseLandmarker()]);
      pose = body;
      await body.setOptions({ outputSegmentationMasks: true });
      if (cancelled) return;

      setPhase("scanning");
      let shoulderSamples: number[] = [];
      let torsoSamples: number[] = [];
      let history = { scales: [] as number[], faceSizes: [] as number[] };
      let firstValid = 0;
      let lastDetection = 0;
      let lastValid = performance.now();
      let lastGood: Tick | null = null;
      let lastWithTorso: Tick | null = null;
      let lastReachCm = 0;

      const pushWindow = (values: number[], value: number) => {
        values.push(value);
        if (values.length > WINDOW) values.shift();
      };
      const finish = (torso: number, spread: number) => {
        const measurement = measurementFromScan(
          median(shoulderSamples),
          torso,
          spread,
          lastReachCm < PARTIAL_CHEST_BELOW_CM,
          {
            outlineShoulderCm: median(shoulderSamples),
            torsoCm: torso,
            jointCm: lastGood?.jointCm ?? null,
            distanceCm: lastGood?.distanceCm ?? null,
            facePx: lastGood?.facePx ?? null,
            irisPx: lastGood?.irisPx ?? null,
            reachCm: lastReachCm,
          },
        );
        const shown = lastWithTorso ?? lastGood;
        setSnapshot(
          shown
            ? makeSnapshot(
                video,
                shown,
                `outline shoulders ${median(shoulderSamples).toFixed(1)} cm · torso ${torso.toFixed(1)} cm · steadiness ±${(spread * 100).toFixed(0)}%`,
              )
            : null,
        );
        setResult(measurement);
        setMeasurement(measurement);
        stopCamera();
        drawOverlay([], { width: 1, height: 1 });
        setPhase("result");
      };

      const loop = (time: number) => {
        if (cancelled) return;
        try {
          if (time - lastDetection >= DETECTION_INTERVAL_MS && video.readyState >= 2) {
            lastDetection = time;
            const tick = measure(face, body, video, time, history);
            drawOverlay(tick.runs, tick.frame);

            if (tick.shoulder !== null) {
              lastGood = tick;
              if (tick.torso !== null) lastWithTorso = tick;
              if (shoulderSamples.length === 0) firstValid = time;
              pushWindow(shoulderSamples, tick.shoulder);
              if (tick.torso !== null) {
                pushWindow(torsoSamples, tick.torso);
                lastReachCm = tick.torsoReachCm ?? lastReachCm;
              }
              lastValid = time;
            } else if (time - lastValid > INVALID_RESET_MS) {
              shoulderSamples = [];
              torsoSamples = [];
              history = { scales: [], faceSizes: [] };
            }

            const elapsed = shoulderSamples.length > 0 ? time - firstValid : 0;
            const hardAccept = elapsed >= HARD_ACCEPT_MS;
            const shoulderFull = shoulderSamples.length >= WINDOW;
            const torsoFull = torsoSamples.length >= WINDOW;
            const shoulderSpread = shoulderFull ? relativeSpread(shoulderSamples) : null;
            const torsoSpread = torsoFull ? relativeSpread(torsoSamples) : null;
            const shoulderOk = shoulderSpread !== null && (shoulderSpread <= MAX_SPREAD || hardAccept);
            const torsoOk = torsoSpread !== null && (torsoSpread <= MAX_SPREAD || hardAccept);

            setChecks(tick.checks);
            setGauge(tick.distanceCm !== null && tick.targetCm !== null ? { distanceCm: tick.distanceCm, targetCm: tick.targetCm } : null);
            setProgress(Math.min(torsoSamples.length / WINDOW, 1));
            setDiagnostics(
              tick.diagnostics +
                (shoulderSpread !== null ? ` · steadiness ±${(shoulderSpread * 100).toFixed(0)}%` : ` · ${shoulderSamples.length}/${WINDOW}`),
            );
            if (tick.shoulder !== null) {
              setGuidance(
                tick.hint ??
                  (tick.torso === null
                    ? "Sit back a little until your chest is in the frame."
                    : torsoFull && !torsoOk
                      ? "Almost there — hold as still as you can…"
                      : "Hold still…"),
              );
            } else {
              setGuidance(tick.blocking ?? DEFAULT_GUIDANCE);
            }

            if (shoulderOk && torsoOk) {
              finish(median(torsoSamples), Math.max(shoulderSpread ?? 0, torsoSpread ?? 0));
              return;
            }
          }
        } catch (error) {
          fail(error);
          return;
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    run().catch(fail);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stopCamera();
      pose?.setOptions({ outputSegmentationMasks: false }).catch(() => {});
    };
  }, [scanId, setMeasurement]);

  function rescan() {
    setResult(null);
    setSnapshot(null);
    setGauge(null);
    setChecks(NO_CHECKS);
    setProgress(0);
    setGuidance(DEFAULT_GUIDANCE);
    setDiagnostics("");
    setPhase("starting");
    setScanId((id) => id + 1);
  }

  const showVideo = phase === "starting" || phase === "scanning";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Measure my size"
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Measure my size
              <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-white">
                Beta
              </span>
            </h2>
            <p className="text-xs text-neutral-500">Runs on your device — no images are uploaded or stored.</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className={`relative mt-4 overflow-hidden rounded-xl bg-neutral-900 ${showVideo ? "" : "hidden"}`}>
          <video ref={videoRef} muted playsInline className="w-full -scale-x-100" />
          <canvas ref={overlayRef} className="absolute inset-0 h-full w-full -scale-x-100" />
          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
              Starting camera and body tracking…
            </div>
          )}
        </div>

        {phase === "scanning" && (
          <div className="mt-3">
            <ul className="mb-2 flex flex-wrap gap-1.5 text-xs" aria-label="Scan checks">
              {(
                [
                  ["face", "Face"],
                  ["shoulders", "Shoulders"],
                  ["chest", "Chest in view"],
                  ["arms", "Arms clear"],
                ] as const
              ).map(([key, label]) => (
                <li
                  key={key}
                  className={`rounded-full px-2.5 py-1 ${
                    checks[key] === "ok"
                      ? "bg-emerald-50 text-emerald-700"
                      : checks[key] === "fail"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {checks[key] === "ok" ? "✓" : checks[key] === "fail" ? "✕" : "•"} {label}
                </li>
              ))}
            </ul>
            <p className="text-sm text-neutral-700" aria-live="polite">
              {guidance}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full bg-neutral-900 transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
            {gauge && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">
                  Sit back a little — you can stay seated.
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  You're at about {(gauge.distanceCm / 100).toFixed(1)} m. Your chest and belly are what decide your
                  T-shirt size, and the camera only sees them from about {(gauge.targetCm / 100).toFixed(1)} m.
                </p>
                <div className="relative mt-2 h-2 rounded-full bg-amber-100" aria-hidden="true">
                  <div
                    className="absolute inset-y-0 rounded-full bg-emerald-300"
                    style={{ left: `${gaugePct(gauge.targetCm)}%`, right: `${100 - gaugePct(MAX_GAUGE_CM)}%` }}
                  />
                  <div
                    className="absolute -top-0.5 h-3 w-3 -translate-x-1/2 rounded-full bg-neutral-900"
                    style={{ left: `${gaugePct(gauge.distanceCm)}%` }}
                  />
                </div>
              </div>
            )}
            {diagnostics && <p className="mt-2 text-[11px] text-neutral-400">{diagnostics}</p>}
          </div>
        )}

        {phase === "result" && result && (
          <div className="mt-2">
            {snapshot && (
              <div className="mb-3">
                <img src={snapshot} alt="The frame used for your measurement, with the measured lines in green" className="w-full rounded-xl" />
                <p className="mt-1 text-[11px] text-neutral-400">
                  The frame the size came from — green lines show what was measured. Kept only in this window.
                </p>
              </div>
            )}
            <p className="text-xs font-medium uppercase text-neutral-400">Your estimated size</p>
            <p className="mt-1 text-4xl font-semibold">
              {result.size}
              {result.alternateSize && (
                <span className="ml-2 text-lg font-normal text-neutral-500">or {result.alternateSize}</span>
              )}
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Estimated chest ≈ {Math.round(result.chestCm)} cm
              {result.alternateSize ? " — you're between two sizes, so either should work." : "."}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Shoulder width ≈ {Math.round(result.shoulderWidthCm)} cm, torso width ≈ {Math.round(result.torsoWidthCm)} cm
              (depth estimated at {Math.round(result.torsoDepthCm)} cm).
            </p>
            {result.partialChest && (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Only your upper chest was in view, so a broad belly can read a little small. Sitting back a bit more
                (about 1 m) shows more of your torso and gives a better size.
              </p>
            )}
            {result.spread > 0.12 && (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                The readings varied quite a bit (±{Math.round(result.spread * 100)}%), so this is less reliable —
                rescan and try to stay still with good lighting.
              </p>
            )}
            <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
              This is an estimate from a single camera view, not a tape measurement — it can be off by a size or
              so. Loose clothing or slouching will inflate it; check the size guide if you're unsure.
            </p>
            {calibrating && <CalibrationPanel measurement={result} />}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={onClose}>
                Check my cart
              </Button>
              <Button variant="secondary" onClick={rescan}>
                Rescan
              </Button>
            </div>
          </div>
        )}

        {phase === "denied" && (
          <div className="mt-4">
            <p className="text-sm text-neutral-700">
              Camera access was blocked. Allow the camera in your browser's site settings, then try again.
            </p>
            <Button className="mt-3" onClick={rescan}>
              Try again
            </Button>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-4">
            <p className="text-sm text-neutral-700">Something went wrong during the scan.</p>
            {errorDetail && <p className="mt-1 break-words text-xs text-neutral-400">{errorDetail}</p>}
            <Button className="mt-3" onClick={rescan}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
