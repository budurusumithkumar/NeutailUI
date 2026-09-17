import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "../../components/Button";
import { ShirtFill } from "./ShirtFill";
import { OVERLAY_SHIRT_VIEWBOX, WORN_SHIRT_PATH } from "./shirtPaths";
import type { TshirtItem } from "./tshirts";

type CameraState = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";

const STATE_MESSAGE: Record<Exclude<CameraState, "active">, string> = {
  idle: "Turn on your camera to see the tee on you.",
  requesting: "Requesting camera access…",
  denied: "Camera access was denied. Allow it in your browser's site settings, then retry.",
  unavailable: "No camera was found on this device.",
  error: "Couldn't start the camera. Please retry.",
};

// A manual-overlay preview, not real body tracking — there is no pose-detection
// backend here, so the customer drags/resizes the shirt themselves to line it
// up in their own camera feed. Nothing captured ever leaves the browser.
export function CameraTryOn({ item }: { item: TshirtItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  const [state, setState] = useState<CameraState>("idle");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("active");
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error");
    }
  }

  function resetOverlay() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.originX + (event.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (event.clientY - dragRef.current.startY),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const clipId = `camera-shirt-${item.id}`;

  return (
    <div className="w-full">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-neutral-900">
        {state === "active" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full [transform:scaleX(-1)] object-cover"
          />
        )}

        {state === "active" && (
          <div
            role="slider"
            aria-label={`Position ${item.name} overlay`}
            aria-valuenow={Math.round(scale * 100)}
            tabIndex={0}
            className="absolute left-1/2 top-1/2 w-[55%] touch-none select-none"
            style={{
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <svg viewBox={OVERLAY_SHIRT_VIEWBOX} className="w-full drop-shadow-lg">
              <defs>
                <clipPath id={clipId}>
                  <path d={WORN_SHIRT_PATH} />
                </clipPath>
              </defs>
              <g opacity={0.92}>
                <ShirtFill item={item} clipId={clipId} />
              </g>
            </svg>
          </div>
        )}

        {state !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-neutral-300">{STATE_MESSAGE[state]}</p>
            <Button variant="secondary" disabled={state === "requesting"} onClick={startCamera}>
              {state === "requesting" ? "Requesting…" : "Enable camera"}
            </Button>
          </div>
        )}
      </div>

      {state === "active" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-neutral-500">Size</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            className="flex-1"
          />
          <button type="button" onClick={resetOverlay} className="text-xs text-neutral-500 underline">
            Reset
          </button>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] text-neutral-400">
        Drag and resize the tee to line it up — this is a manual overlay, not real body
        tracking, and nothing is uploaded.
      </p>
    </div>
  );
}
