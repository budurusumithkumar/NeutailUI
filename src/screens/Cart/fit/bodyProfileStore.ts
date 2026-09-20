import { create } from "zustand";
import type { BodyMeasurement } from "./sizing";

// Deliberately in-memory only (no localStorage): body measurements are personal, and
// the scan is cheap to redo. Nothing is persisted or uploaded.
interface BodyProfileState {
  measurement: BodyMeasurement | null;
  setMeasurement: (measurement: BodyMeasurement | null) => void;
}

export const useBodyProfileStore = create<BodyProfileState>((set) => ({
  measurement: null,
  setMeasurement: (measurement) => set({ measurement }),
}));
