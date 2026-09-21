// Pure geometry on the pose model's person mask — no React, no camera. Real-world scale is
// supplied by faceScale.ts (from the user's own face), so nothing has to be typed in.
// Every number here is an estimate to be calibrated.

export interface MaskView {
  width: number;
  height: number;
  /** Person confidence 0..1 per pixel, row-major. */
  data: ArrayLike<number>;
}

export interface Landmark {
  x: number;
  y: number;
  visibility: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface OverlayRun {
  y: number;
  left: number;
  right: number;
}

const FG_THRESHOLD = 0.5;
const MAX_RUN_GAP_PX = 2;
const MIN_LANDMARK_VISIBILITY = 0.5;
const EDGE_MARGIN_FRACTION = 0.02;

// Rows sampled, in cm below the shoulder line: below the armpits (so raised arms aren't included)
// down through the upper abdomen — the widest part a T-shirt has to go around.
// The torso is always measured on the same fixed strip, however far away the person sits. A band that grew
// with the visible frame measured a different part of the body at every distance (thin chest strip at
// 0.5 m, chest plus belly at 0.8 m) — one of the reasons repeated scans of one person disagreed.
const BAND_FROM_CM = 12;
const BAND_TO_CM = 18;
const BAND_ROW_STEP_PX = 2;
const WIDTH_PERCENTILE = 85;

// A torso this close to the full outer shoulder width means the arms have merged into the silhouette. It is
// compared with the outer (deltoid) outline, not the shoulder-joint landmarks, which sit well inside it —
// comparing against those wrongly rejected any broad torso, so such a customer could never finish a scan.
const MAX_TORSO_TO_OUTER_SHOULDER = 0.96;
const MIN_TORSO_WIDTH_CM = 20;
// Fewer clear (non-merged) rows than this and the band is treated as arms-blended.
const MIN_CLEAR_ROWS = 5;
const MAX_TORSO_WIDTH_CM = 70;

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const MIN_JOINT_DISTANCE_CM = 27;
const MAX_JOINT_DISTANCE_CM = 52;
// The outline must poke out beyond the shoulder-joint landmarks by at least this much on each side.
const MIN_OUTER_MARGIN_CM = 1;

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

function isForeground(mask: MaskView, x: number, y: number): boolean {
  return x >= 0 && x < mask.width && y >= 0 && y < mask.height && mask.data[y * mask.width + x] > FG_THRESHOLD;
}

/** The foreground run containing (or nearest to) centerX on this row, tolerating tiny gaps. */
export function rowRun(mask: MaskView, y: number, centerX: number): { left: number; right: number } | null {
  const row = Math.round(y);
  let start = Math.round(centerX);
  if (!isForeground(mask, start, row)) {
    const reach = Math.round(mask.width * 0.1);
    let found = -1;
    for (let d = 1; d <= reach && found < 0; d++) {
      if (isForeground(mask, start - d, row)) found = start - d;
      else if (isForeground(mask, start + d, row)) found = start + d;
    }
    if (found < 0) return null;
    start = found;
  }
  let left = start;
  for (let gap = 0, x = start - 1; x >= 0 && gap <= MAX_RUN_GAP_PX; x--) {
    if (isForeground(mask, x, row)) {
      left = x;
      gap = 0;
    } else gap++;
  }
  let right = start;
  for (let gap = 0, x = start + 1; x < mask.width && gap <= MAX_RUN_GAP_PX; x++) {
    if (isForeground(mask, x, row)) {
      right = x;
      gap = 0;
    } else gap++;
  }
  return { left, right };
}

export interface Failure {
  ok: false;
  message: string;
  /** Set when the chest is below the frame: by what factor the camera distance must grow to fit it. */
  moveBackFactor?: number;
  /** Which requirement failed, so the UI can show a checklist. */
  reason?: "reach" | "arms" | "unclear";
  /** Numbers behind the failure, for the on-screen diagnostics line. */
  detail?: string;
}

// Outer shoulder width (deltoid to deltoid) is read from the silhouette a few cm below the shoulder
// joints, where the arms' outer edges are widest — the joint landmarks themselves sit inside that.
const SHOULDER_FROM_CM = 2;
const SHOULDER_TO_CM = 8;
const MIN_SHOULDER_WIDTH_CM = 30;
const MAX_SHOULDER_WIDTH_CM = 70;
const FRAME_EDGE_PX = 3;

export interface ShoulderSample {
  ok: true;
  /** Outer (deltoid-to-deltoid) shoulder width from the person outline. */
  shoulderWidthCm: number;
  /** Distance between the shoulder-joint landmarks — shown for diagnosis only; it can be badly wrong (30 cm for a ~50 cm shoulder). */
  jointDistanceCm: number;
  runs: OverlayRun[];
}

/** Outer (deltoid-to-deltoid) shoulder width. `cmPerPx` is cm per video pixel on the shoulder plane. */
export function shoulderSample(
  mask: MaskView,
  pose: Landmark[] | undefined,
  cmPerPx: number,
  video: Size2D,
): ShoulderSample | Failure {
  const shoulders = pose ? [pose[LEFT_SHOULDER], pose[RIGHT_SHOULDER]] : [];
  if (shoulders.length === 0 || shoulders.some((p) => !p || p.visibility < MIN_LANDMARK_VISIBILITY)) {
    return { ok: false, message: "We can't see both shoulders — face the camera with both shoulders in the frame." };
  }
  const cmPerMaskPxX = cmPerPx * (video.width / mask.width);
  const cmPerMaskPxY = cmPerPx * (video.height / mask.height);
  const shoulderY = ((shoulders[0].y + shoulders[1].y) / 2) * mask.height;
  const centerX = ((shoulders[0].x + shoulders[1].x) / 2) * mask.width;
  const jointLeft = Math.min(shoulders[0].x, shoulders[1].x) * mask.width;
  const jointRight = Math.max(shoulders[0].x, shoulders[1].x) * mask.width;
  const marginPx = MIN_OUTER_MARGIN_CM / cmPerMaskPxX;

  // A close-up of the head and chest made the pose model put the shoulder points on the chest (22 cm
  // apart). Real shoulder joints are ~32–44 cm apart, so anything wildly off means it is guessing.
  const jointDistanceCm = (jointRight - jointLeft) * cmPerMaskPxX;
  if (jointDistanceCm < MIN_JOINT_DISTANCE_CM || jointDistanceCm > MAX_JOINT_DISTANCE_CM) {
    return { ok: false, message: "Couldn't find your shoulders clearly — sit back a little so both shoulders are fully in the frame." };
  }

  const runs: OverlayRun[] = [];
  const widths: number[] = [];
  let touchesEdge = false;
  let outlineTooNarrow = false;
  for (let y = Math.round(shoulderY + SHOULDER_FROM_CM / cmPerMaskPxY); y <= Math.round(shoulderY + SHOULDER_TO_CM / cmPerMaskPxY); y++) {
    const run = rowRun(mask, y, centerX);
    if (!run) continue;
    if (run.left <= FRAME_EDGE_PX || run.right >= mask.width - 1 - FRAME_EDGE_PX) touchesEdge = true;
    if (run.left > jointLeft - marginPx || run.right < jointRight + marginPx) outlineTooNarrow = true;
    runs.push({ y, ...run });
    widths.push((run.right - run.left + 1) * cmPerMaskPxX);
  }
  if (touchesEdge) return { ok: false, message: "Move back a little so both shoulders are fully inside the frame." };
  if (widths.length < 3 || outlineTooNarrow) {
    return { ok: false, message: "Couldn't get a clean outline of your shoulders — check the lighting and that your whole upper body is in view." };
  }

  const rawOutlineCm = percentile(widths, WIDTH_PERCENTILE);
  if (rawOutlineCm < MIN_SHOULDER_WIDTH_CM || rawOutlineCm > MAX_SHOULDER_WIDTH_CM) {
    return { ok: false, message: "Couldn't get a clean read of your shoulders — hold still." };
  }
  return { ok: true, shoulderWidthCm: rawOutlineCm, jointDistanceCm, runs };
}

export interface TorsoSample {
  ok: true;
  torsoWidthCm: number;
  /** How far below the shoulder line (cm) the sampled band reached — short bands miss the widest part (belly). */
  reachCm: number;
  runs: OverlayRun[];
}

/**
 * Front-view torso width at the widest point between armpits and upper abdomen.
 * `torsoCmPerPx` is cm per *video* pixel at the torso plane; the mask may have a different resolution.
 */
export function torsoSample(
  mask: MaskView,
  pose: Landmark[] | undefined,
  torsoCmPerPx: number,
  video: Size2D,
  outerShoulderWidthCm: number,
): TorsoSample | Failure {
  const shoulders = pose ? [pose[LEFT_SHOULDER], pose[RIGHT_SHOULDER]] : [];
  if (shoulders.length === 0 || shoulders.some((p) => !p || p.visibility < MIN_LANDMARK_VISIBILITY)) {
    return { ok: false, message: "We can't see both shoulders — face the camera and sit or stand a little further back." };
  }

  const cmPerMaskPxX = torsoCmPerPx * (video.width / mask.width);
  const cmPerMaskPxY = torsoCmPerPx * (video.height / mask.height);

  const shoulderY = ((shoulders[0].y + shoulders[1].y) / 2) * mask.height;
  const centerX = ((shoulders[0].x + shoulders[1].x) / 2) * mask.width;
  const rowFrom = shoulderY + BAND_FROM_CM / cmPerMaskPxY;
  const limit = mask.height * (1 - EDGE_MARGIN_FRACTION);
  const rowNeeded = shoulderY + BAND_TO_CM / cmPerMaskPxY;
  if (rowNeeded > limit) {
    // Everything scales about the image centre as the camera moves away.
    const moveBackFactor = (rowNeeded - mask.height / 2) / (limit - mask.height / 2);
    return { ok: false, message: "Your chest isn't fully in the frame.", moveBackFactor, reason: "reach" };
  }
  const rowTo = rowNeeded;

  // Judge every row on its own: just under the armpit the arm always touches the torso, so those rows are
  // as wide as the shoulders even with the elbows out, while rows further down show the torso alone.
  // Rows that merged with an arm are ignored; the torso is measured from the rest.
  const runs: OverlayRun[] = [];
  const clearWidths: number[] = [];
  const allWidths: number[] = [];
  const mergedLimitCm = outerShoulderWidthCm * MAX_TORSO_TO_OUTER_SHOULDER;
  for (let y = Math.round(rowFrom); y <= Math.round(rowTo); y += BAND_ROW_STEP_PX) {
    const run = rowRun(mask, y, centerX);
    if (!run) continue;
    const widthCm = (run.right - run.left + 1) * cmPerMaskPxX;
    allWidths.push(widthCm);
    if (widthCm <= mergedLimitCm) {
      clearWidths.push(widthCm);
      runs.push({ y, ...run });
    }
  }
  if (allWidths.length < MIN_CLEAR_ROWS) return { ok: false, message: "Couldn't get a clean read — hold still.", reason: "unclear" };
  if (clearWidths.length < MIN_CLEAR_ROWS) {
    return {
      ok: false,
      message: "Rest your hands on your lap with your elbows slightly out, so your arms don't blend into your torso.",
      reason: "arms",
      detail: `torso ${percentile(allWidths, 50).toFixed(0)} cm = ${Math.round((percentile(allWidths, 50) / outerShoulderWidthCm) * 100)}% of shoulders (needs < ${Math.round(MAX_TORSO_TO_OUTER_SHOULDER * 100)}%)`,
    };
  }
  // Median of the clear rows: a fixed strip has no belly to catch, and its widest rows are the ones nearest an arm.
  const torsoWidthCm = percentile(clearWidths, 50);
  if (torsoWidthCm < MIN_TORSO_WIDTH_CM || torsoWidthCm > MAX_TORSO_WIDTH_CM) {
    return { ok: false, message: "Couldn't get a clean read — hold still.", reason: "unclear" };
  }
  return { ok: true, torsoWidthCm, reachCm: BAND_TO_CM, runs };
}
