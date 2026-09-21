import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button";
import { loadPoseLandmarker } from "../../../lib/poseLandmarker";
import { CalibrationPanel } from "./CalibrationPanel";
import { isCalibrationMode } from "./calibration";
import { useBodyProfileStore } from "./bodyProfileStore";
import { measurementFromShoulderWidth, median, relativeSpread, type BodyMeasurement } from "./sizing";

// The original, quick size scan: pose model only. It measures the 3D distance between the shoulder joints
// (the model's metric "world" landmarks), takes the median of ~40 steady frames, and turns that into a chest
// and size. No face, height, torso or second scan — fast and smooth, but it cannot see chest or belly.

type ScanState = "requesting" | "loadingModel" | "scanning" | "result" | "denied" | "error";

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

const DETECTION_INTERVAL_MS = 50;
const MIN_VISIBILITY = 0.6;
const EDGE_MARGIN = 0.03;
const MAX_SHOULDER_DEPTH_DIFF_M = 0.1;
const REQUIRED_SAMPLES = 40;
const MAX_SPREAD = 0.06;
const POSE_LOST_RESET_MS = 1000;

const GUIDANCE_DEFAULT = "Sit or stand back so both shoulders are fully in frame, arms down and still.";

interface Point {
  x: number;
  y: number;
  visibility: number;
}

function inFrame(point: Point): boolean {
  return (
    point.x > EDGE_MARGIN && point.x < 1 - EDGE_MARGIN && point.y > EDGE_MARGIN && point.y < 1 - EDGE_MARGIN
  );
}

export function ShoulderScanModal({ onClose }: { onClose: () => void }) {
  const setMeasurement = useBodyProfileStore((state) => state.setMeasurement);
  const [calibrating] = useState(isCalibrationMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [scanId, setScanId] = useState(0);
  const [state, setState] = useState<ScanState>("requesting");
  const [progress, setProgress] = useState(0);
  const [guidance, setGuidance] = useState(GUIDANCE_DEFAULT);
  const [result, setResult] = useState<BodyMeasurement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId = 0;

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      } catch {
        if (!cancelled) setState("denied");
        return;
      }
      const video = videoRef.current;
      if (cancelled || !video) return;
      video.srcObject = stream;
      await video.play();

      if (!cancelled) setState("loadingModel");
      const landmarker = await loadPoseLandmarker();
      if (cancelled) return;

      setState("scanning");
      const samples: number[] = [];
      let lastDetection = 0;
      let lastValid = performance.now();

      const loop = (time: number) => {
        if (cancelled) return;
        if (time - lastDetection >= DETECTION_INTERVAL_MS && video.readyState >= 2) {
          lastDetection = time;
          const detected = landmarker.detectForVideo(video, time);
          const pose = detected.landmarks[0];
          const world = detected.worldLandmarks[0];
          drawOverlay(pose);

          const check = pose && world ? validate(pose, world) : { ok: false, message: GUIDANCE_DEFAULT };
          if (check.ok && world) {
            const dx = world[LEFT_SHOULDER].x - world[RIGHT_SHOULDER].x;
            const dy = world[LEFT_SHOULDER].y - world[RIGHT_SHOULDER].y;
            const dz = world[LEFT_SHOULDER].z - world[RIGHT_SHOULDER].z;
            samples.push(Math.hypot(dx, dy, dz));
            lastValid = time;
            setGuidance("Hold still…");
          } else {
            setGuidance(check.message);
            if (time - lastValid > POSE_LOST_RESET_MS) samples.length = 0;
          }
          setProgress(Math.min(samples.length / REQUIRED_SAMPLES, 1));

          if (samples.length >= REQUIRED_SAMPLES) {
            if (relativeSpread(samples) <= MAX_SPREAD) {
              const measurement = measurementFromShoulderWidth(median(samples));
              setResult(measurement);
              setMeasurement(measurement);
              stream?.getTracks().forEach((track) => track.stop());
              setState("result");
              return;
            }
            samples.splice(0, samples.length - Math.floor(REQUIRED_SAMPLES / 2));
            setGuidance("Hold still for a moment longer…");
          }
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    function validate(pose: Point[], world: { z: number }[]): { ok: boolean; message: string } {
      const points = [pose[LEFT_SHOULDER], pose[RIGHT_SHOULDER]];
      if (points.some((p) => !p || p.visibility < MIN_VISIBILITY)) {
        return { ok: false, message: "We can't see both shoulders clearly — keep your arms down and still." };
      }
      if (!points.every(inFrame)) {
        return { ok: false, message: "Move back so both shoulders are fully inside the frame." };
      }
      if (Math.abs(world[LEFT_SHOULDER].z - world[RIGHT_SHOULDER].z) > MAX_SHOULDER_DEPTH_DIFF_M) {
        return { ok: false, message: "Face the camera squarely so both shoulders are level with it." };
      }
      return { ok: true, message: "" };
    }

    function drawOverlay(pose: Point[] | undefined) {
      const canvas = overlayRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !video || !ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!pose) return;
      const pts = [LEFT_SHOULDER, RIGHT_SHOULDER].map((i) => pose[i]);
      if (pts.some((p) => !p)) return;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(2, canvas.width / 200);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);
      ctx.lineTo(pts[1].x * canvas.width, pts[1].y * canvas.height);
      ctx.stroke();
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, ctx.lineWidth * 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    run().catch(() => {
      if (!cancelled) setState("error");
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanId, setMeasurement]);

  function rescan() {
    setResult(null);
    setProgress(0);
    setGuidance(GUIDANCE_DEFAULT);
    setState("requesting");
    setScanId((id) => id + 1);
  }

  const showVideo = state === "scanning" || state === "loadingModel" || state === "requesting";

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
          {state !== "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
              {state === "requesting" ? "Requesting camera…" : "Loading body-tracking model…"}
            </div>
          )}
        </div>

        {state === "scanning" && (
          <div className="mt-3">
            <p className="text-sm text-neutral-700" aria-live="polite">
              {guidance}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full bg-neutral-900 transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        {state === "result" && result && (
          <div className="mt-2">
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
            <p className="mt-1 text-xs text-neutral-500">Shoulder width ≈ {Math.round(result.shoulderWidthCm)} cm.</p>
            <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
              This is a quick estimate from your shoulder width, not a tape measurement — it can't see your chest or
              belly, so it can be off by a size or more. Check the size guide if you're unsure.
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

        {state === "denied" && (
          <div className="mt-4">
            <p className="text-sm text-neutral-700">
              Camera access was blocked. Allow the camera in your browser's site settings, then try again.
            </p>
            <Button className="mt-3" onClick={rescan}>
              Try again
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="mt-4">
            <p className="text-sm text-neutral-700">Something went wrong starting the scan.</p>
            <Button className="mt-3" onClick={rescan}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
