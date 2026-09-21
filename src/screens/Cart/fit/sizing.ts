// Pure sizing logic for the cart's "check my fit" feature — no React, no camera.
// Everything here is a heuristic estimate from a single front-facing webcam view;
// the constants below are the knobs to calibrate against tape-measured customers.

export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
export type LetterSize = (typeof SIZE_ORDER)[number];

// Upper body-chest bound (cm) per size, Indian-style tee chart: S=36in, M=38in, L=40in,
// XL=42in, XXL=44in, XXXL=46in (2-inch / ~5 cm steps), boundaries at the midpoints.
// Last size is open-ended. Brands differ — this is the main knob to calibrate.
const CHEST_UPPER_BOUND_CM: readonly number[] = [89, 94, 99, 104, 109, 114];

// UK women's clothing sizes 4..24 (step 2) with typical bust (cm); boundaries are the
// midpoints between neighbouring sizes.
const UK_MIN_SIZE = 4;
const UK_BUST_CM: readonly number[] = [74, 78, 82, 86, 91, 97, 103, 109, 115, 121, 127];
const UK_BOUND_CM: readonly number[] = UK_BUST_CM.slice(1).map((bust, i) => (bust + UK_BUST_CM[i]) / 2);

// Within this many cm of a size boundary the person is "between" two sizes.
const LETTER_BORDERLINE_MARGIN_CM = 2;
const UK_BORDERLINE_MARGIN_CM = 1.5;

function locate(chestCm: number, bounds: readonly number[], margin: number) {
  let index = bounds.findIndex((bound) => chestCm < bound);
  if (index === -1) index = bounds.length;
  let alternate: number | null = null;
  const upper = bounds[index];
  const lower = bounds[index - 1];
  if (upper !== undefined && upper - chestCm <= margin) alternate = index + 1;
  else if (lower !== undefined && chestCm - lower <= margin) alternate = index - 1;
  return { index, alternate };
}

/** The raw numbers behind a scan, kept so a reading can be compared with tape measurements (calibration mode). */
export interface ScanRaw {
  outlineShoulderCm: number;
  torsoCm: number;
  jointCm: number | null;
  distanceCm: number | null;
  facePx: number | null;
  irisPx: number | null;
  reachCm: number;
}

export type ScanEngine = "shoulder-v1" | "face-torso-v2";

export interface BodyMeasurement {
  /** Which scan produced this: the original quick shoulder-width scan, or the face-scale + torso scan. */
  engine?: ScanEngine;
  size: LetterSize;
  /** Neighbouring size when the chest estimate is within the borderline margin of a boundary. */
  alternateSize: LetterSize | null;
  /** Estimated torso girth at the widest point between chest and abdomen. */
  chestCm: number;
  /** Outer (deltoid-to-deltoid) shoulder width measured. */
  shoulderWidthCm: number;
  /** Front-view torso width measured, and the front-to-back depth estimated from it. */
  torsoWidthCm: number;
  torsoDepthCm: number;
  /** How much the final readings varied (IQR / median); higher means the person moved or the camera was noisy. */
  spread: number;
  raw?: ScanRaw;
  /** The chest estimate from each agreeing scan (the result is their mean). */
  scanChestsCm?: number[];
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Spread of the middle half of the samples relative to their median (robust to outliers). */
export function relativeSpread(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return (q3 - q1) / median(values);
}

// Added to the ellipse girth to account for the T-shirt/clothing the silhouette includes (about 1 cm of
// fabric around the torso is ~6 cm of girth; fitted tops less). Uncalibrated.
export const GIRTH_ADJUST_CM = -4;

/** Perimeter of an ellipse with the given full axes (Ramanujan's approximation). */
export function ellipseGirth(widthCm: number, depthCm: number): number {
  const a = widthCm / 2;
  const b = depthCm / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

// A front view can't show how thick the torso is, so depth is estimated from width. Deeper-chested,
// larger builds have proportionally deeper torsos, hence the slope. Unvalidated — calibrate.
export const DEPTH_PER_WIDTH = 0.62;
export const DEPTH_OFFSET_CM = 2.5;

export function estimateTorsoDepthCm(torsoWidthCm: number): number {
  return DEPTH_PER_WIDTH * torsoWidthCm + DEPTH_OFFSET_CM;
}

// The outline includes the sleeve/shirt shoulder, ~1.5 cm on each side beyond the body.
export const SHOULDER_CLOTHING_ALLOWANCE_CM = 3;

// The chest comes from the torso strip alone. Shoulder width used to be blended in (x2.4), but it was the noisiest
// input — one person's outline read 42 to 63 cm across scans — so it is now only a sanity check and a display value.
export function measurementFromScan(
  outlineShoulderWidthCm: number,
  torsoWidthCm: number,
  spread = 0,
  raw?: ScanRaw,
  scanChestsCm?: number[],
): BodyMeasurement {
  const shoulderWidthCm = outlineShoulderWidthCm - SHOULDER_CLOTHING_ALLOWANCE_CM;
  const torsoDepthCm = estimateTorsoDepthCm(torsoWidthCm);
  const chestCm = ellipseGirth(torsoWidthCm, torsoDepthCm) + GIRTH_ADJUST_CM;
  const { index, alternate } = locate(chestCm, CHEST_UPPER_BOUND_CM, LETTER_BORDERLINE_MARGIN_CM);
  return {
    engine: "face-torso-v2",
    size: SIZE_ORDER[index],
    alternateSize: alternate === null ? null : SIZE_ORDER[alternate],
    chestCm,
    shoulderWidthCm,
    torsoWidthCm,
    torsoDepthCm,
    spread,
    raw,
    scanChestsCm,
  };
}

/** Letter size (and a neighbour when within the borderline margin) for a chest measurement in cm. */
export function sizeFromChest(chestCm: number): { size: LetterSize; alternateSize: LetterSize | null } {
  const { index, alternate } = locate(chestCm, CHEST_UPPER_BOUND_CM, LETTER_BORDERLINE_MARGIN_CM);
  return { size: SIZE_ORDER[index], alternateSize: alternate === null ? null : SIZE_ORDER[alternate] };
}

// The original quick scan: the pose model's metric ("world") shoulder-joint distance, and chest taken as
// this multiple of it. Fast and needs no face, torso or height, but it cannot see chest or belly and the
// pose model's world scale drifts toward an average body, so a true XXL read as XS/S/M.
export const CHEST_TO_SHOULDER_RATIO = 2.4;

export function measurementFromShoulderWidth(shoulderWidthM: number): BodyMeasurement {
  const shoulderWidthCm = shoulderWidthM * 100;
  const chestCm = shoulderWidthCm * CHEST_TO_SHOULDER_RATIO;
  return {
    engine: "shoulder-v1",
    ...sizeFromChest(chestCm),
    chestCm,
    shoulderWidthCm,
    torsoWidthCm: 0,
    torsoDepthCm: 0,
    spread: 0,
  };
}

const SIZE_ALIASES: Record<string, LetterSize> = {
  SMALL: "S",
  MEDIUM: "M",
  LARGE: "L",
  "X-LARGE": "XL",
  XLARGE: "XL",
  "2XL": "XXL",
  "XX-LARGE": "XXL",
  "3XL": "XXXL",
  "XXX-LARGE": "XXXL",
};

/** Returns null for non-letter sizes (e.g. "UK 10", "32") — those can't be compared to a chest size. */
export function normalizeSize(size: string | null | undefined): LetterSize | null {
  if (!size) return null;
  const upper = size.trim().toUpperCase();
  if ((SIZE_ORDER as readonly string[]).includes(upper)) return upper as LetterSize;
  return SIZE_ALIASES[upper] ?? null;
}

// Softer than a strict size-for-size match: the camera estimate is only good to about a size, so only sizes
// two or more steps away are flagged; one step either way is just noted as close.
export type FitVerdict = "good" | "close" | "too_small" | "too_large" | "unknown";

export interface FitAssessment {
  verdict: FitVerdict;
  label: string;
  /** True for verdicts likely to cause a return (drives the warning styling and summary count). */
  atRisk: boolean;
  /** Size to switch to, or null when the current size already fits or can't be judged. */
  suggestedSize: string | null;
}

// A size system the body's chest can be located on. Indexes run smallest to largest.
interface Scale {
  parse(size: string): number | null;
  locateBody(chestCm: number): { index: number; alternate: number | null };
  format(index: number, like?: string | null): string;
  defaults(like?: string | null): string[];
}

const letterScale: Scale = {
  parse: (size) => {
    const letter = normalizeSize(size);
    return letter ? SIZE_ORDER.indexOf(letter) : null;
  },
  locateBody: (chestCm) => locate(chestCm, CHEST_UPPER_BOUND_CM, LETTER_BORDERLINE_MARGIN_CM),
  format: (index) => SIZE_ORDER[index],
  defaults: () => SIZE_ORDER.slice(0, 6),
};

const UK_SIZE_PATTERN = /^(UK\s*)?(\d{1,2})$/i;

const ukScale: Scale = {
  // Bare numbers 4-24 are read as UK sizes (this is a UK store); other systems (EU/US/waist) are left unparsed.
  parse: (size) => {
    const match = UK_SIZE_PATTERN.exec(size.trim());
    if (!match) return null;
    const number = Number(match[2]);
    if (number < UK_MIN_SIZE || number > UK_MIN_SIZE + (UK_BUST_CM.length - 1) * 2) return null;
    return Math.round((number - UK_MIN_SIZE) / 2);
  },
  locateBody: (chestCm) => locate(chestCm, UK_BOUND_CM, UK_BORDERLINE_MARGIN_CM),
  format: (index, like) => `${/^UK/i.test(like?.trim() ?? "") ? "UK " : ""}${UK_MIN_SIZE + index * 2}`,
  defaults: (like) => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ukScale.format(i, like)),
};

function scaleFor(size: string | null | undefined, availableSizes?: string[]): Scale | null {
  const candidates = [size, ...(availableSizes ?? [])];
  for (const scale of [letterScale, ukScale]) {
    if (candidates.some((candidate) => candidate && scale.parse(candidate) !== null)) return scale;
  }
  return null;
}

/** Sensible dropdown options for an item that doesn't list its own available sizes. */
export function defaultSizesFor(size: string | null | undefined): string[] {
  const scale = scaleFor(size);
  return scale ? scale.defaults(size) : letterScale.defaults();
}

function nearestAvailable(scale: Scale, target: number, like: string | null | undefined, available?: string[]): string | null {
  if (!available || available.length === 0) return scale.format(target, like);
  let best: { size: string; distance: number } | null = null;
  for (const size of available) {
    const index = scale.parse(size);
    if (index === null) continue;
    const distance = Math.abs(index - target);
    if (best === null || distance < best.distance) best = { size, distance };
  }
  return best ? best.size : null;
}

export function assessFit(
  itemSize: string | null | undefined,
  body: BodyMeasurement,
  availableSizes?: string[],
): FitAssessment {
  const scale = scaleFor(itemSize, availableSizes);
  const itemIndex = itemSize && scale ? scale.parse(itemSize) : null;

  if (!scale || itemIndex === null) {
    return {
      verdict: "unknown",
      label: itemSize ? `Can't compare size "${itemSize}"` : "Choose a size",
      atRisk: false,
      suggestedSize: !itemSize && scale ? nearestAvailable(scale, scale.locateBody(body.chestCm).index, null, availableSizes) : null,
    };
  }

  const { index: bodyIndex, alternate } = scale.locateBody(body.chestCm);
  if (itemIndex === bodyIndex || itemIndex === alternate) {
    return { verdict: "good", label: "Good fit", atRisk: false, suggestedSize: null };
  }

  const target = nearestAvailable(scale, bodyIndex, itemSize, availableSizes);
  const suggestedSize = target && scale.parse(target) !== itemIndex ? target : null;
  const diff = itemIndex - bodyIndex;

  if (Math.abs(diff) === 1) {
    return { verdict: "close", label: "Close to your estimated size", atRisk: false, suggestedSize: null };
  }
  if (diff < 0) return { verdict: "too_small", label: "Likely too small", atRisk: true, suggestedSize };
  return { verdict: "too_large", label: "Likely too large", atRisk: true, suggestedSize };
}
