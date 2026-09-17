import type { UpsellResult } from "../../../api/types";
import { Chip } from "../../../components/Chip";

function formatCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function llmStatus(upsell: UpsellResult): string {
  if (upsell.llm_invoked === true) return "Invoked for customer wording";
  if (upsell.llm_invoked === false) return "Not invoked";
  if (upsell.status === "NO_OFFER") return "Skipped by no-offer policy";
  if (upsell.message) return "Customer wording returned";
  return "Not reported";
}

export function UpsellDecisionDetails({
  upsell,
  traceId,
}: {
  upsell: UpsellResult;
  traceId: string;
}) {
  const offerName = upsell.offer?.title ?? upsell.offer?.offer_type;

  return (
    <details className="max-w-md rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-600">
      <summary className="cursor-pointer font-medium text-neutral-700">
        Demo: governed upsell decision
      </summary>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        <dt className="text-neutral-400">Decision</dt>
        <dd className="font-medium text-neutral-800">{formatCode(upsell.status)}</dd>

        {upsell.trigger_type && (
          <>
            <dt className="text-neutral-400">Trigger</dt>
            <dd>{formatCode(upsell.trigger_type)}</dd>
          </>
        )}

        {typeof upsell.trigger_strength === "number" && (
          <>
            <dt className="text-neutral-400">Strength</dt>
            <dd>{Math.round(upsell.trigger_strength * 100)}%</dd>
          </>
        )}

        {offerName && (
          <>
            <dt className="text-neutral-400">Selected offer</dt>
            <dd>{offerName}</dd>
          </>
        )}

        {upsell.opportunity_band && (
          <>
            <dt className="text-neutral-400">Opportunity</dt>
            <dd>
              {formatCode(upsell.opportunity_band)}
              {typeof upsell.opportunity_score === "number"
                ? ` (${Math.round(upsell.opportunity_score * 100)}%)`
                : ""}
            </dd>
          </>
        )}

        <dt className="text-neutral-400">Consent</dt>
        <dd>{upsell.requires_customer_consent ? "Required" : "Not required"}</dd>

        <dt className="text-neutral-400">LLM path</dt>
        <dd>{llmStatus(upsell)}</dd>

        {traceId && (
          <>
            <dt className="text-neutral-400">Trace</dt>
            <dd className="break-all font-mono text-[11px]">{traceId}</dd>
          </>
        )}
      </dl>

      {upsell.eligibility_reasons.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-neutral-400">Eligibility reasons</p>
          <div className="flex flex-wrap gap-1.5">
            {upsell.eligibility_reasons.map((reason) => (
              <Chip key={reason} tone="success">
                {formatCode(reason)}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {upsell.suppression_reasons.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-neutral-400">Suppression reasons</p>
          <div className="flex flex-wrap gap-1.5">
            {upsell.suppression_reasons.map((reason) => (
              <Chip key={reason} tone="warning">
                {formatCode(reason)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}
