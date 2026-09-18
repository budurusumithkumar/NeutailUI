# Photorealistic Try-On — Future Options (Proposal, Not Built)

**Status:** Proposal / not scoped or built, except for a time-boxed spike of Option B (see below). Everything else in this document is a sketch for a *possible future* iteration of the Wardrobe/Try-On screen, written up after the current live camera overlay hit a realism ceiling in testing. Nothing here changes what's shipped today (see [01-screens.md](01-screens.md) for the current, built version).

## Spike results — Option B (WebGPU)

A time-boxed spike was built at `src/screens/TryOn3D/` (route `/try-on-3d`, reachable only by direct URL — not linked from navigation, not integrated with the catalog). Scope matched the recommendation below exactly: one recolored mesh, live-rendered, on a tracked body, no occlusion, no fallback.

**What it validates:**
- `three@0.186.0`'s `WebGPURenderer` and `@mediapipe/tasks-vision`'s `PoseLandmarker` run concurrently in the same render loop without contention — sustained **60fps** in testing (WebGPU render + pose inference at a 60ms detection interval).
- A 9-vertex/8-triangle mesh, deformed each frame from tracked shoulder/hip landmarks with a forward Z bulge at the chest, reads as genuinely 3D — real geometry and lighting respond correctly to whatever pose the body is in, which is the specific thing 2D canvas compositing (the shipped feature) cannot do.
- `navigator.gpu` and a real WebGPU adapter/device are available in this project's own test environment, which was itself an open question going in.

**Not validated (out of scope for this spike, and still open questions):** real-world tracking accuracy/robustness (only synthetic test fixtures were exercised, since the environment used to build this has no real camera), occlusion, mobile/Safari WebGPU support, a WebGL fallback path, and integration with the actual catalog (the spike hardcodes one shirt color).

**One non-obvious pitfall worth flagging for anyone building on this further:** a `MeshBasicMaterial` background quad placed *behind* the tracked mesh (for the camera passthrough) came out fully transparent with three.js's default `side: THREE.FrontSide` — it needed `side: THREE.DoubleSide` to render at all. Easy to lose time to since it fails silently (no console error, no exception — the canvas just renders as transparent, which read as solid black against the page background).

## Why this exists

The current live try-on (`src/screens/TryOn/CameraTryOn.tsx`, `bodySegmentation.ts`, `drawGarmentFill.ts`) recolors the customer's actual shirt in real time using 2D canvas compositing: BodyPix segmentation for the mask, a flat synthetic fill for color/pattern, a generic ambient gradient for a baseline 3D look, and a real-but-heavily-processed lighting layer on top for responsive fold detail. Several rounds of real-world testing converged on the same conclusion: this is a genuine, working *fit/color preview* — instant, fully client-side, zero cost — but 2D image compositing has a hard ceiling. It cannot produce fabric that folds correctly in 3D, because it has no notion of 3D geometry at all; it's manipulating pixels, not simulating cloth over a body.

Getting past that ceiling means picking one of the approaches below, each a materially larger project than anything in the current feature.

## Option A — Backend-mediated AI-generated snapshot ("Generate my look")

A one-shot, non-live feature: the customer takes a single photo, it's sent to the backend, and a purpose-built virtual try-on model returns a photorealistic composite a few seconds later.

**Flow**
1. Customer picks a tee, taps "Generate my look" (a separate action from the live overlay, not a replacement for it).
2. Frontend captures one frame from the camera (or a photo upload).
3. **Explicit consent screen** before anything uploads — this breaks the current feature's "nothing leaves the browser" property, so it needs an honest, unavoidable prompt, not a buried checkbox.
4. Frontend uploads the photo + selected SKU to a new backend endpoint; backend returns a job id (generation takes several seconds — this is an async job, not a synchronous response).
5. Frontend polls (or uses SSE) for the result, then shows the generated image with save/retry/add-to-cart actions.
6. Backend deletes the uploaded photo and the generated image shortly after delivery — no standing storage of a customer's photo.

**The model**: a dedicated image-to-image "virtual try-on" diffusion model (e.g., OOTDiffusion, IDM-VTON — open-source options exist today), not a language model. Takes a person photo + a garment photo, outputs a photorealistic composite. Needs GPU inference — self-hosted or a vendor API — which is backend infrastructure, not something the frontend calls directly (no API key belongs in client code, and the compute doesn't belong in a browser tab).

**New requirement this surfaces**: these models composite against a real garment photo, not a flat icon. The current catalog (`tshirts.ts`) is deliberately photo-free. Offering this well means sourcing real product photography for at least the SKUs it covers — a content cost, not just an engineering one.

**Backend scope** (their team, sketched only): the generation endpoint + job polling, the model/vendor integration, temporary-storage-with-deletion for uploaded photos, rate limiting (each generation likely costs real money in GPU time or vendor fees), and consent logging.

**Trade-offs**: genuinely photorealistic; not live (seconds of wait); requires a photo upload with explicit consent; needs new garment photography and backend infra (GPU hosting or a vendor contract).

## Option B — WebGPU live 3D rendering

Keep it live and in-browser, but replace 2D compositing with an actual 3D garment mesh rendered over a tracked body — real geometry and lighting instead of an image-blend heuristic.

**Pipeline**
1. **Body tracking** — swap (or supplement) BodyPix for a model giving skeletal landmarks with relative depth, not just a pixel mask: MediaPipe Pose Landmarker (BlazePose) is the standard web-capable option.
2. **Garment asset** — a real 3D T-shirt mesh (glTF), rigged/skinned to that skeleton so it deforms with shoulder/torso/arm rotation. One base mesh, retextured per catalog color/pattern, mirroring the current data-driven catalog approach.
3. **Rendering** — a WebGPU pipeline, via an existing engine rather than raw WGSL (Three.js's `WebGPURenderer` or Babylon.js both have real WebGPU support), draws the camera feed as a background quad, updates the mesh's skinning to the current frame's pose, and renders it with a lit material. Highlights/shadows come from real geometry and lighting, so they're automatically correct for whatever pose the body is in — this is the part that directly answers "natural 3D folding."
4. **Occlusion** — the standard hard sub-problem in AR try-on: if the customer crosses their arms in front of their chest, the rendered shirt must be clipped where the real arm should occlude it. Needs the existing pixel-level segmentation mask kept around specifically for this clipping, even though body tracking now comes from a different (skeletal) model.
5. **Fallback** — feature-detect `navigator.gpu`; devices/browsers without WebGPU (some mobile Safari versions still, older hardware) fall back to exactly what's shipped today. Additive, not a replacement that breaks unsupported visitors.

**What's genuinely new work**: a 3D asset pipeline (even one simple mesh), integrating a different body-tracking model, learning/wiring up a 3D rendering library, and solving occlusion — none of which exists in the current codebase.

**Trade-offs**: stays live and fully client-side (no backend, no photo upload, no privacy trade-off); realism depends on the visitor's actual GPU, which varies far more on the web than on a curated set of phones; meaningfully larger effort (3D asset + rendering pipeline) than anything shipped so far; WebGPU browser support is still maturing, especially on mobile Safari.

## Related, not sketched here: native mobile

A native iOS/Android app could do better than either web option — ARKit/ARCore give real-time 3D body tracking plus depth sensors on some hardware, and on-device ML acceleration (Core ML / NNAPI) can run heavier models, including a compressed on-device diffusion model for an on-device version of Option A with no cloud round-trip. Not sketched in detail here because it implies a different project (native apps) rather than an evolution of this React frontend.

## Comparison

| | Current (shipped) | A — AI snapshot | B — WebGPU 3D | Native mobile |
|---|---|---|---|---|
| Live/continuous | Yes | No (few-second wait) | Yes | Yes |
| Realistic 3D folding | No (2D heuristic) | Yes | Yes (geometry-driven) | Yes (best) |
| Stays on-device | Yes | No (photo uploaded) | Yes | Yes |
| Needs backend work | No | Yes (new endpoint + GPU/vendor) | No | Maybe (if cloud-assisted) |
| Needs new content | No | Yes (garment photos) | Yes (3D assets) | Depends on approach |
| Needs new engineering discipline | No | Vendor/API integration | 3D graphics/AR | Native + 3D/AR or on-device ML |
| Relative effort | — | Medium (mostly backend + content) | Large (new rendering subsystem) | Largest (new apps) |

## Recommendation

Don't fold either option into the current feature's iteration loop — both are separate initiatives, not tweaks. If photorealism is worth pursuing, time-box a standalone spike for whichever option fits the product's priorities (privacy-and-cost-conscious → lean toward B; simplicity and highest realism → lean toward A) before committing to full catalog support, and validate the riskiest assumption first (Option A: does the chosen model's output quality justify the photo-upload trade-off; Option B: is body-tracking + rendering performance actually good enough on typical customer hardware).
