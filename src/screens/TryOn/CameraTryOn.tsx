import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { drawShirtOnCanvas } from "./drawShirtOnCanvas";
import { estimateTorso, loadPoseDetector, smoothTorso } from "./poseTracking";
import type { TorsoPose } from "./poseTracking";
import type { TshirtItem } from "./tshirts";

type CameraState =
  | "idle"
  | "requesting"
  | "loadingModel"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

const STATE_MESSAGE: Record<Exclude<CameraState, "active">, string> = {
  idle: "Turn on your camera to see the tee on you.",
  requesting: "Requesting camera access…",
  loadingModel: "Loading virtual try-on…",
  denied: "Camera access was denied. Allow it in your browser's site settings, then retry.",
  unavailable: "No camera was found on this device.",
  error: "Couldn't start the camera. Please retry.",
};

const DETECTION_INTERVAL_MS = 80;

// Tracks the customer's shoulders/torso (MoveNet, see poseTracking.ts) each frame
// and draws the selected tee warped to that position/rotation/scale directly onto
// a canvas, on top of the mirrored camera feed — a real (if approximate) AR
// overlay, not a screen-fixed sticker. Nothing captured ever leaves the browser.
export function CameraTryOn({ item }: { item: TshirtItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const torsoRef = useRef<TorsoPose | null>(null);
  const itemRef = useRef(item);
  const sizeAdjustRef = useRef(1);

  const [state, setState] = useState<CameraState>("idle");
  const [sizeAdjust, setSizeAdjust] = useState(1);
  const [personVisible, setPersonVisible] = useState(true);

  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  useEffect(() => {
    sizeAdjustRef.current = sizeAdjust;
  }, [sizeAdjust]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function runRenderLoop() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !video || !ctx) return;

    const frame = () => {
      if (!runningRef.current) return;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (torsoRef.current) {
        drawShirtOnCanvas(ctx, torsoRef.current, itemRef.current, sizeAdjustRef.current);
      }
      ctx.restore();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  async function runDetectLoop(video: HTMLVideoElement, detector: Awaited<ReturnType<typeof loadPoseDetector>>) {
    let lastVisible = true;
    while (runningRef.current) {
      try {
        const poses = await detector.estimatePoses(video, { flipHorizontal: false });
        const next = poses[0] ? estimateTorso(poses[0]) : null;
        torsoRef.current = smoothTorso(torsoRef.current, next);
        const visible = torsoRef.current !== null;
        if (visible !== lastVisible) {
          lastVisible = visible;
          setPersonVisible(visible);
        }
      } catch {
        // A single failed detection frame shouldn't kill the loop.
      }
      await new Promise((resolve) => setTimeout(resolve, DETECTION_INTERVAL_MS));
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not mounted");
      video.srcObject = stream;
      await video.play();
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
      }

      setState("loadingModel");
      const detector = await loadPoseDetector();

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 640;
      }

      setPersonVisible(true);
      runningRef.current = true;
      setState("active");
      runRenderLoop();
      void runDetectLoop(video, detector);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error");
    }
  }

  return (
    <div className="w-full">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-neutral-900">
        {/* Always mounted so the ref is valid whenever startCamera() needs it —
            it's never shown directly; the canvas below draws from it each frame. */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full opacity-0" />

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full object-cover ${state === "active" ? "" : "invisible"}`}
        />

        {state === "active" && !personVisible && (
          <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            Step back so we can see your shoulders
          </p>
        )}

        {state !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-neutral-300">{STATE_MESSAGE[state]}</p>
            <Button
              variant="secondary"
              disabled={state === "requesting" || state === "loadingModel"}
              onClick={startCamera}
            >
              {state === "requesting" || state === "loadingModel" ? "Please wait…" : "Enable camera"}
            </Button>
          </div>
        )}
      </div>

      {state === "active" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-neutral-500">Fit</span>
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.02}
            value={sizeAdjust}
            onChange={(event) => setSizeAdjust(Number(event.target.value))}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setSizeAdjust(1)}
            className="text-xs text-neutral-500 underline"
          >
            Reset
          </button>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] text-neutral-400">
        Tracks your shoulders in real time so the tee moves with you — an approximate
        overlay, not a real garment simulation. Nothing is uploaded.
      </p>
    </div>
  );
}
