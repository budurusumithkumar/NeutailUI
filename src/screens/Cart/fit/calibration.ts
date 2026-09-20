// Calibration mode: pairs a scan's raw numbers with tape measurements so the size formulas can be fitted
// to real people instead of guessed. Stored on this device only (localStorage); nothing is uploaded.
import type { BodyMeasurement } from "./sizing";

const STORAGE_KEY = "neutail_calibration_v1";
const PERSON_KEY = "neutail_calibration_person";
const FLAG_KEY = "neutail_calibrate";

export type FitPreference = "fitted" | "regular" | "loose";

export interface CalibrationInput {
  person: string;
  tapeChestCm: number;
  tapeBellyCm: number | null;
  tapeShoulderCm: number | null;
  usualSize: string;
  fit: FitPreference;
}

export interface CalibrationRecord extends CalibrationInput {
  savedAt: string;
  scan: {
    estChestCm: number;
    estSize: string;
    estAltSize: string | null;
    adjShoulderCm: number;
    torsoCm: number;
    torsoDepthEstCm: number;
    partialChest: boolean;
    spread: number;
    outlineShoulderCm: number | null;
    jointCm: number | null;
    distanceCm: number | null;
    facePx: number | null;
    irisPx: number | null;
    reachCm: number | null;
  };
}

/** On with `?calibrate=1` in the URL (remembered), off with `?calibrate=0`. */
export function isCalibrationMode(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("calibrate");
    if (param === "1") localStorage.setItem(FLAG_KEY, "1");
    if (param === "0") localStorage.removeItem(FLAG_KEY);
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function loadRecords(): CalibrationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalibrationRecord[]) : [];
  } catch {
    return [];
  }
}

export function lastPerson(): string {
  try {
    return localStorage.getItem(PERSON_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRecord(measurement: BodyMeasurement, input: CalibrationInput): CalibrationRecord[] {
  const record: CalibrationRecord = {
    ...input,
    savedAt: new Date().toISOString(),
    scan: {
      estChestCm: measurement.chestCm,
      estSize: measurement.size,
      estAltSize: measurement.alternateSize,
      adjShoulderCm: measurement.shoulderWidthCm,
      torsoCm: measurement.torsoWidthCm,
      torsoDepthEstCm: measurement.torsoDepthCm,
      partialChest: measurement.partialChest,
      spread: measurement.spread,
      outlineShoulderCm: measurement.raw?.outlineShoulderCm ?? null,
      jointCm: measurement.raw?.jointCm ?? null,
      distanceCm: measurement.raw?.distanceCm ?? null,
      facePx: measurement.raw?.facePx ?? null,
      irisPx: measurement.raw?.irisPx ?? null,
      reachCm: measurement.raw?.reachCm ?? null,
    },
  };
  const records = [...loadRecords(), record];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    localStorage.setItem(PERSON_KEY, input.person);
  } catch {
    // storage unavailable — the record simply isn't kept
  }
  return records;
}

export function clearRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

const CSV_COLUMNS: [string, (r: CalibrationRecord) => string | number | boolean | null][] = [
  ["savedAt", (r) => r.savedAt],
  ["person", (r) => r.person],
  ["tapeChestCm", (r) => r.tapeChestCm],
  ["tapeBellyCm", (r) => r.tapeBellyCm],
  ["tapeShoulderCm", (r) => r.tapeShoulderCm],
  ["usualSize", (r) => r.usualSize],
  ["fit", (r) => r.fit],
  ["estChestCm", (r) => Math.round(r.scan.estChestCm * 10) / 10],
  ["estSize", (r) => r.scan.estSize],
  ["estAltSize", (r) => r.scan.estAltSize],
  ["outlineShoulderCm", (r) => r.scan.outlineShoulderCm],
  ["adjShoulderCm", (r) => r.scan.adjShoulderCm],
  ["torsoCm", (r) => r.scan.torsoCm],
  ["torsoDepthEstCm", (r) => r.scan.torsoDepthEstCm],
  ["jointCm", (r) => r.scan.jointCm],
  ["distanceCm", (r) => r.scan.distanceCm],
  ["facePx", (r) => r.scan.facePx],
  ["irisPx", (r) => r.scan.irisPx],
  ["reachCm", (r) => r.scan.reachCm],
  ["partialChest", (r) => r.scan.partialChest],
  ["spread", (r) => r.scan.spread],
];

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = typeof value === "number" ? String(Math.round(value * 100) / 100) : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(records: CalibrationRecord[]): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(",");
  const rows = records.map((record) => CSV_COLUMNS.map(([, get]) => csvCell(get(record))).join(","));
  return [header, ...rows].join("\n");
}
