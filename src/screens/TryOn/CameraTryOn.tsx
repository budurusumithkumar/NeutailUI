import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import type { BodyPix } from "@tensorflow-models/body-pix";
import { loadBodySegmenter, segmentGarmentMask } from "./bodySegmentation";
import type { GarmentBounds } from "./bodySegmentation";
import { drawGarmentFill } from "./drawGarmentFill";
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

const DETECTION_INTERVAL_MS = 120;

// Recolors the customer's *actual* shirt in the live camera feed to the
// selected tee, instead of warping a synthetic shape over their body: BodyPix
// (see bodySegmentation.ts) segments which pixels are torso/upper-arm each
// frame, the backdrop is softened (blurred) within that region to erase the
// real garment's own pattern while keeping broad fold/shadow shading, and the
// render loop blends the selected color/pattern on top using the canvas
// "color" composite mode, which keeps that (now-softened) backdrop luminance
// and only swaps hue/saturation. This only recolors clothing that's already
// there — it can't add a garment where there is none, or change a collar/
// sleeve shape. Nothing captured leaves the browser.
export function CameraTryOn({ item }: { item: TshirtItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const maskCanvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const fillCanvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const softCanvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const boundsRef = useRef<GarmentBounds | null>(null);
  const itemRef = useRef(item);

  const [state, setState] = useState<CameraState>("idle");
  const [personVisible, setPersonVisible] = useState(true);

  useEffect(() => {
    itemRef.current = item;
  }, [item]);

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

    const fillCanvas = fillCanvasRef.current;
    const fillCtx = fillCanvas.getContext("2d");
    const softCanvas = softCanvasRef.current;
    const softCtx = softCanvas.getContext("2d");

    const frame = () => {
      if (!runningRef.current) return;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const maskCanvas = maskCanvasRef.current;
      if (fillCtx && softCtx && maskCanvas.width > 0) {
        // The "color" blend below keeps the backdrop's real luminance — but the
        // customer's actual shirt often already has its own pattern (stripes,
        // a logo) baked into that luminance as light/dark bands, which then
        // shows through underneath whatever we draw. Softening the backdrop
        // first blurs away that existing pattern's fine detail while keeping
        // the broader fold/shadow shading, so the *selected* pattern reads
        // clearly instead of visually fighting the real one.
        softCanvas.width = canvas.width;
        softCanvas.height = canvas.height;
        softCtx.filter = "blur(14px)";
        softCtx.drawImage(video, 0, 0, softCanvas.width, softCanvas.height);
        softCtx.filter = "none";
        softCtx.globalCompositeOperation = "destination-in";
        softCtx.drawImage(maskCanvas, 0, 0, softCanvas.width, softCanvas.height);
        softCtx.globalCompositeOperation = "source-over";
        ctx.drawImage(softCanvas, 0, 0);

        fillCanvas.width = canvas.width;
        fillCanvas.height = canvas.height;
        fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);
        drawGarmentFill(fillCtx, itemRef.current, fillCanvas.width, fillCanvas.height, boundsRef.current);

        fillCtx.globalCompositeOperation = "destination-in";
        fillCtx.filter = "blur(3px)";
        fillCtx.drawImage(maskCanvas, 0, 0, fillCanvas.width, fillCanvas.height);
        fillCtx.filter = "none";
        fillCtx.globalCompositeOperation = "source-over";

        // "color" keeps the (now-softened) backdrop's luminance — the real
        // fold/shadow shading — and only takes hue+saturation from our fill.
        ctx.globalCompositeOperation = "color";
        ctx.drawImage(fillCanvas, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.restore();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  async function runDetectLoop(video: HTMLVideoElement, net: BodyPix) {
    let lastVisible = true;
    while (runningRef.current) {
      try {
        const result = await segmentGarmentMask(net, video, maskCanvasRef.current);
        if (result.found) {
          boundsRef.current = result.bounds;
        }
        if (result.found !== lastVisible) {
          lastVisible = result.found;
          setPersonVisible(result.found);
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
      const net = await loadBodySegmenter();

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 640;
      }

      setPersonVisible(true);
      runningRef.current = true;
      setState("active");
      runRenderLoop();
      void runDetectLoop(video, net);
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

      <p className="mt-2 text-center text-[11px] text-neutral-400">
        Recolors the shirt you're already wearing to this tee, in real time — it can't
        add a garment where there isn't one. Nothing is uploaded.
      </p>
    </div>
  );
}
