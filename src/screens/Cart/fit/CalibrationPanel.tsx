import { useState } from "react";
import { Button } from "../../../components/Button";
import {
  clearRecords,
  lastPerson,
  loadRecords,
  saveRecord,
  toCsv,
  type FitPreference,
} from "./calibration";
import type { BodyMeasurement } from "./sizing";

const inputClass = "w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm";

function toNumber(text: string): number | null {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) ? value : null;
}

/** Shown under a scan result in calibration mode: record the tape-measured truth next to the scan. */
export function CalibrationPanel({ measurement }: { measurement: BodyMeasurement }) {
  const [person, setPerson] = useState(lastPerson());
  const [chest, setChest] = useState("");
  const [belly, setBelly] = useState("");
  const [shoulder, setShoulder] = useState("");
  const [usualSize, setUsualSize] = useState("");
  const [fit, setFit] = useState<FitPreference>("regular");
  const [count, setCount] = useState(() => loadRecords().length);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    const tapeChestCm = toNumber(chest);
    if (tapeChestCm === null || tapeChestCm < 60 || tapeChestCm > 200) {
      setMessage("Enter the tape-measured chest in cm (60–200).");
      return;
    }
    const records = saveRecord(measurement, {
      person: person.trim(),
      tapeChestCm,
      tapeBellyCm: toNumber(belly),
      tapeShoulderCm: toNumber(shoulder),
      usualSize: usualSize.trim(),
      fit,
    });
    setCount(records.length);
    setSaved(true);
    setMessage(`Saved — ${records.length} reading${records.length === 1 ? "" : "s"} on this device.`);
  }

  async function copyJson() {
    const text = JSON.stringify(loadRecords(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied all readings as JSON.");
    } catch {
      setMessage("Couldn't copy — use Download CSV instead.");
    }
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(loadRecords())], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "neutail-size-calibration.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3" data-testid="calibration-panel">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Calibration mode</p>
      <p className="mt-1 text-xs text-violet-900">
        Record the real measurements for this person so the size formulas can be fitted to data. Stored on this
        device only.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs text-violet-900">
          Who is this? (name or initials)
          <input className={inputClass} value={person} onChange={(e) => setPerson(e.target.value)} />
        </label>
        <label className="text-xs text-violet-900">
          Tape chest, cm (fullest part) *
          <input className={inputClass} inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} />
        </label>
        <label className="text-xs text-violet-900">
          Tape belly, cm (at navel)
          <input className={inputClass} inputMode="decimal" value={belly} onChange={(e) => setBelly(e.target.value)} />
        </label>
        <label className="text-xs text-violet-900">
          Tape shoulder width, cm
          <input
            className={inputClass}
            inputMode="decimal"
            value={shoulder}
            onChange={(e) => setShoulder(e.target.value)}
          />
        </label>
        <label className="text-xs text-violet-900">
          Usual T-shirt size
          <input className={inputClass} value={usualSize} onChange={(e) => setUsualSize(e.target.value)} />
        </label>
        <label className="col-span-2 text-xs text-violet-900">
          How that size fits
          <select className={inputClass} value={fit} onChange={(e) => setFit(e.target.value as FitPreference)}>
            <option value="fitted">Fitted</option>
            <option value="regular">Regular</option>
            <option value="loose">Loose</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button className="!px-3 !py-1 text-xs" onClick={save} disabled={saved}>
          {saved ? "Saved" : "Save this reading"}
        </Button>
        <Button variant="secondary" className="!px-3 !py-1 text-xs" onClick={copyJson} disabled={count === 0}>
          Copy all (JSON)
        </Button>
        <Button variant="secondary" className="!px-3 !py-1 text-xs" onClick={downloadCsv} disabled={count === 0}>
          Download CSV
        </Button>
        <button
          className="text-xs text-violet-700 underline disabled:opacity-40"
          disabled={count === 0}
          onClick={() => {
            if (window.confirm(`Delete all ${count} saved calibration readings from this device?`)) {
              clearRecords();
              setCount(0);
              setMessage("Cleared.");
            }
          }}
        >
          Clear all
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-violet-900">{message}</p>}
      <p className="mt-1 text-[11px] text-violet-700">{count} saved so far.</p>
    </div>
  );
}
