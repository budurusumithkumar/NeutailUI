import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { loadPoseLandmarker } from "../../lib/poseLandmarker";
import { extractTorso } from "./poseTracking3D";
import { createShirtGeometry, updateShirtGeometry } from "./shirtMesh";

type Status = "idle" | "requesting" | "loadingModel" | "active" | "unsupported" | "denied" | "error";

const SHIRT_COLOR = 0x2f6fb0;
const DETECTION_INTERVAL_MS = 60;

/**
 * Time-boxed spike for docs/07-photorealistic-tryon-options.md, Option B:
 * one recolored mesh, live-rendered, on a tracked body, no occlusion, no
 * fallback. The goal is only to answer "is body tracking + WebGPU rendering
 * performance actually good enough on typical hardware" — not to ship a
 * feature. Deliberately excluded: catalog integration, occlusion handling,
 * a WebGL fallback for unsupported browsers, and a mirror transform.
 */
export function TryOn3DScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>(() => ("gpu" in navigator ? "requesting" : "unsupported"));
  const [fps, setFps] = useState(0);
  const [trackingLost, setTrackingLost] = useState(false);

  useEffect(() => {
    if (!("gpu" in navigator)) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let renderer: THREE.WebGPURenderer | null = null;
    let rafId = 0;
    let lastDetectionTime = 0;
    let frameCount = 0;
    let fpsWindowStart = performance.now();

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      } catch {
        if (!cancelled) setStatus("denied");
        return;
      }
      if (cancelled || !videoRef.current) return;

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      setStatus("loadingModel");
      const [landmarker] = await Promise.all([loadPoseLandmarker()]);
      if (cancelled || !canvasRef.current) return;

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const canvas = canvasRef.current;
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
      await renderer.init();
      renderer.setSize(videoWidth, videoHeight, false);

      const scene = new THREE.Scene();

      // top=0, bottom=videoHeight so image-space Y maps directly onto the
      // scene without a sign flip — see shirtMesh.ts.
      const camera = new THREE.OrthographicCamera(0, videoWidth, 0, videoHeight, 1, 1500);
      camera.position.z = 500;

      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      const bgGeometry = new THREE.PlaneGeometry(videoWidth, videoHeight);
      const bgMaterial = new THREE.MeshBasicMaterial({
        map: videoTexture,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
      bgMesh.position.set(videoWidth / 2, videoHeight / 2, -500);
      bgMesh.renderOrder = -1;
      scene.add(bgMesh);

      scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      const directional = new THREE.DirectionalLight(0xffffff, 1.5);
      directional.position.set(videoWidth * 0.3, -videoHeight * 0.3, 400);
      scene.add(directional);

      const shirtGeometry = createShirtGeometry();
      const shirtMaterial = new THREE.MeshStandardMaterial({ color: SHIRT_COLOR, roughness: 0.75, metalness: 0.05 });
      const shirtMesh = new THREE.Mesh(shirtGeometry, shirtMaterial);
      shirtMesh.visible = false;
      scene.add(shirtMesh);

      setStatus("active");

      const renderLoop = (time: number) => {
        if (cancelled) return;

        if (time - lastDetectionTime >= DETECTION_INTERVAL_MS) {
          lastDetectionTime = time;
          const result = landmarker.detectForVideo(video, time);
          const poseLandmarks = result.landmarks[0];
          const torso = poseLandmarks ? extractTorso(poseLandmarks) : null;
          if (torso) {
            updateShirtGeometry(shirtGeometry, torso, videoWidth, videoHeight);
            shirtMesh.visible = true;
            setTrackingLost(false);
          } else {
            setTrackingLost(true);
          }
        }

        frameCount++;
        if (time - fpsWindowStart >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          fpsWindowStart = time;
        }

        renderer?.render(scene, camera);
        rafId = requestAnimationFrame(renderLoop);
      };
      rafId = requestAnimationFrame(renderLoop);
    }

    start().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
      renderer?.dispose();
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">WebGPU Try-On Spike</h1>
        <p className="text-sm text-slate-500">
          Experimental — validates tracking + rendering performance only. See{" "}
          <code>docs/07-photorealistic-tryon-options.md</code>. Not linked from navigation.
        </p>
      </div>

      {status === "unsupported" && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          This browser doesn't support WebGPU (<code>navigator.gpu</code> is unavailable). No fallback is
          implemented in this spike.
        </p>
      )}
      {status === "denied" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Camera permission was denied.</p>
      )}
      {status === "error" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Something failed while starting the spike.</p>
      )}
      {(status === "requesting" || status === "loadingModel") && (
        <p className="text-sm text-slate-500">{status === "requesting" ? "Requesting camera…" : "Loading pose model…"}</p>
      )}

      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className="hidden" />
        <canvas ref={canvasRef} className="w-full" />
        {status === "active" && (
          <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">{fps} fps</div>
        )}
        {status === "active" && trackingLost && (
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
            Tracking lost — step back into frame
          </div>
        )}
      </div>
    </div>
  );
}
