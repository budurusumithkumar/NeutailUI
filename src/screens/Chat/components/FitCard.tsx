import type { FitResult, RiskBand } from "../../../api/types";
import { Chip } from "../../../components/Chip";

const riskTone: Record<RiskBand, "success" | "warning" | "danger"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
};

export function FitCard({ fit }: { fit: FitResult }) {
  return (
    <div className="max-w-sm rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Fit check</p>
        {fit.risk_band && <Chip tone={riskTone[fit.risk_band]}>{fit.risk_band} risk</Chip>}
      </div>
      <dl className="mt-2 space-y-1 text-sm text-neutral-600">
        {fit.requested_size && (
          <div className="flex justify-between">
            <dt>Requested size</dt>
            <dd>{fit.requested_size}</dd>
          </div>
        )}
        {fit.recommended_size && (
          <div className="flex justify-between">
            <dt>Recommended size</dt>
            <dd className="font-medium text-neutral-900">{fit.recommended_size}</dd>
          </div>
        )}
        {typeof fit.confidence === "number" && (
          <div className="flex justify-between">
            <dt>Confidence</dt>
            <dd>{Math.round(fit.confidence * 100)}%</dd>
          </div>
        )}
      </dl>
      {fit.explanation && <p className="mt-2 text-xs text-neutral-500">{fit.explanation}</p>}
    </div>
  );
}
