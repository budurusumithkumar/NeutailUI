import { useState } from "react";
import type { FitIntervention, RiskBand } from "../../api/types";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";

const riskTone: Record<RiskBand, "success" | "warning" | "danger"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
};

interface FitInterventionCardProps {
  intervention: FitIntervention;
  disabled: boolean;
  onAccept: (size: string) => Promise<boolean>;
  onDecline: () => Promise<boolean>;
  onDismiss: () => Promise<boolean>;
}

export function FitInterventionCard({
  intervention,
  disabled,
  onAccept,
  onDecline,
  onDismiss,
}: FitInterventionCardProps) {
  const [reviewing, setReviewing] = useState(false);
  const [selectedSize, setSelectedSize] = useState(intervention.recommended_size);

  async function confirmExchange() {
    if (await onAccept(selectedSize)) setReviewing(false);
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
            Post-delivery fit recommendation
          </p>
          <h3 className="mt-1 font-semibold text-neutral-900">{intervention.product_name}</h3>
        </div>
        <div className="flex gap-2">
          <Chip tone={riskTone[intervention.risk_level]}>
            {intervention.risk_level} risk
          </Chip>
          <Chip tone="warning">Simulated exchange</Chip>
        </div>
      </div>

      <p className="mt-3 text-sm text-neutral-700">{intervention.message}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-neutral-500">Delivered</dt>
          <dd className="font-semibold">Size {intervention.delivered_size}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Recommended</dt>
          <dd className="font-semibold text-violet-800">Size {intervention.recommended_size}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-neutral-500">
        Confidence {Math.round(intervention.confidence * 100)}%. Stock is checked at SKU level for this demo.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={disabled} onClick={() => setReviewing(true)}>
          Review exchange
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => void onDecline()}>
          Decline
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={() => void onDismiss()}>
          Dismiss
        </Button>
      </div>

      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fit-exchange-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="fit-exchange-title" className="text-lg font-semibold">
              Confirm simulated exchange
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Choose an available catalogue size. This demo records an exchange request but does not contact a carrier or ship an item.
            </p>
            <label className="mt-4 block text-sm font-medium" htmlFor="exchange-size">
              Exchange size
            </label>
            <select
              id="exchange-size"
              value={selectedSize}
              onChange={(event) => setSelectedSize(event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
              disabled={disabled}
            >
              {intervention.available_sizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={disabled} onClick={() => setReviewing(false)}>
                Cancel
              </Button>
              <Button disabled={disabled} onClick={() => void confirmExchange()}>
                {disabled ? "Confirming…" : "Confirm exchange"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
