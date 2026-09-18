import * as THREE from "three/webgpu";
import type { Torso } from "./poseTracking3D";

/**
 * A 3x3 grid of vertices (shoulder / mid-torso / hip rows, each with a left,
 * center, and right column) forming a minimal but genuinely 3D shirt front —
 * the spike's whole point is to prove that real geometry (the center column
 * pushed toward the camera) reads as natural folding, unlike the old 2D
 * canvas approach's flat synthetic shading. 8 triangles, indices below.
 *
 *   0---1---2   shoulder row
 *   |  /|  /|
 *   3---4---5   mid row
 *   |  /|  /|
 *   6---7---8   hip row
 */
const INDICES = [0, 3, 1, 3, 4, 1, 1, 4, 2, 4, 5, 2, 3, 6, 4, 6, 7, 4, 4, 7, 5, 7, 8, 5];

export function createShirtGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(9 * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(INDICES);
  return geometry;
}

/**
 * Recomputes all 9 vertex positions from the current frame's tracked torso.
 * Image-space coordinates (MediaPipe's normalized x/y, scaled to video
 * pixels) map directly to the mesh's X/Y — the caller's orthographic camera
 * is set up with top=0, bottom=videoHeight specifically so no Y-flip is
 * needed here. Z pushes the center column toward the camera (positive Z) to
 * give the torso an actual 3D curve instead of a flat plane.
 */
export function updateShirtGeometry(
  geometry: THREE.BufferGeometry,
  torso: Torso,
  videoWidth: number,
  videoHeight: number,
): void {
  const ls = torso.leftShoulder;
  const rs = torso.rightShoulder;
  const lh = torso.leftHip;
  const rh = torso.rightHip;

  const toPx = (nx: number, ny: number): [number, number] => [nx * videoWidth, ny * videoHeight];

  const [lsx, lsy] = toPx(ls.x, ls.y);
  const [rsx, rsy] = toPx(rs.x, rs.y);
  const [lhx, lhy] = toPx(lh.x, lh.y);
  const [rhx, rhy] = toPx(rh.x, rh.y);

  const shoulderWidth = Math.hypot(lsx - rsx, lsy - rsy);
  const bulge = shoulderWidth * 0.16;

  // Left/right columns follow the shoulder/hip landmarks directly; widen
  // slightly outward when an elbow is confidently tracked, so a bent/raised
  // arm doesn't leave the mesh looking narrower than the actual garment.
  const armSpread = shoulderWidth * 0.08;
  const leftSpread = torso.leftElbow ? armSpread : 0;
  const rightSpread = torso.rightElbow ? armSpread : 0;

  const midX = (lsx + rsx + lhx + rhx) / 4;
  const midY = (lsy + rsy + lhy + rhy) / 4;

  // Row 0: shoulders (z=0, the mesh's back plane).
  const p0: [number, number, number] = [lsx - leftSpread, lsy, 0];
  const p2: [number, number, number] = [rsx + rightSpread, rsy, 0];
  const p1: [number, number, number] = [(lsx + rsx) / 2, (lsy + rsy) / 2, bulge];

  // Row 1: midpoint between shoulders and hips, pushed forward the most —
  // this is the chest, the point of greatest natural curvature.
  const p3: [number, number, number] = [(lsx + lhx) / 2 - leftSpread * 0.5, (lsy + lhy) / 2, bulge * 0.6];
  const p5: [number, number, number] = [(rsx + rhx) / 2 + rightSpread * 0.5, (rsy + rhy) / 2, bulge * 0.6];
  const p4: [number, number, number] = [midX, midY, bulge * 1.3];

  // Row 2: hips (z=0, back to the plane).
  const p6: [number, number, number] = [lhx, lhy, 0];
  const p8: [number, number, number] = [rhx, rhy, 0];
  const p7: [number, number, number] = [(lhx + rhx) / 2, (lhy + rhy) / 2, bulge * 0.3];

  const positionAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const verts = [p0, p1, p2, p3, p4, p5, p6, p7, p8];
  for (let i = 0; i < verts.length; i++) {
    positionAttr.setXYZ(i, verts[i][0], verts[i][1], verts[i][2]);
  }
  positionAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}
