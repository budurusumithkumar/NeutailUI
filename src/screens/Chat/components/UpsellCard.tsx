import { useState } from "react";
import type { UpsellResult } from "../../../api/types";
import { Button } from "../../../components/Button";

// Parent only renders this when eligible && action === "PRESENT_OFFER"
// (docs/04-chat-response-rendering.md) — no gating needed here.
export function UpsellCard({ upsell }: { upsell: UpsellResult }) {
  const [decision, setDecision] = useState<"accepted" | "dismissed" | null>(null);

  return (
    <div className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-medium uppercase text-amber-700">Neu.Tail Concierge</p>
      {upsell.service_name && (
        <p className="mt-1 text-sm font-semibold text-amber-900">{upsell.service_name}</p>
      )}
      {upsell.message && <p className="mt-1 text-sm text-amber-800">{upsell.message}</p>}

      {decision === null ? (
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            className="px-3 py-1.5 text-xs"
            onClick={() => setDecision("accepted")}
          >
            Yes, please
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={() => setDecision("dismissed")}
          >
            No thanks
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-amber-700">
          {decision === "accepted" ? "Great — noted!" : "No problem."}
        </p>
      )}
    </div>
  );
}
