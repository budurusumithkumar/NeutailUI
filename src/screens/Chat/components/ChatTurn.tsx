import type {
  ChatResponse,
  ProductCard as ProductCardType,
  UpsellResult,
} from "../../../api/types";
import { AgentActivityStrip } from "./AgentActivityStrip";
import { FitCard } from "./FitCard";
import { ProductCard } from "./ProductCard";
import { UpsellCard, type UpsellUserAction } from "./UpsellCard";
import { UpsellDecisionDetails } from "./UpsellDecisionDetails";

const showUpsellDecisionDetails =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_DETAILS === "true";

interface ChatTurnProps {
  response: ChatResponse;
  onAddToCart: (product: ProductCardType) => void;
  onAskFit: (product: ProductCardType) => void;
  onOpenDetail: (product: ProductCardType) => void;
  onUpsellRespond: (
    upsell: UpsellResult,
    action: UpsellUserAction,
  ) => Promise<boolean>;
  upsellActionPending: boolean;
}

// Implements the rendering algorithm in docs/04-chat-response-rendering.md:
// text always, then products / fit / upsell if present, then the activity strip.
export function ChatTurn({
  response,
  onAddToCart,
  onAskFit,
  onOpenDetail,
  onUpsellRespond,
  upsellActionPending,
}: ChatTurnProps) {
  const products = response.products ?? [];
  const agentActivity = response.agent_activity ?? [];
  const showUpsell =
    response.upsell?.status === "OFFER_AVAILABLE" && response.upsell.should_offer;

  return (
    <div className="max-w-[85%] space-y-3">
      <div className="inline-block rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm">
        {response.message}
      </div>

      {products.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {products.map((product) => (
            <ProductCard
              key={product.sku}
              product={product}
              onAddToCart={onAddToCart}
              onAskFit={onAskFit}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}

      {response.fit && <FitCard fit={response.fit} />}

      {showUpsell && response.upsell && (
        <UpsellCard
          upsell={response.upsell}
          sessionId={response.session_id}
          traceId={response.trace_id}
          disabled={upsellActionPending}
          onRespond={(action) => onUpsellRespond(response.upsell!, action)}
        />
      )}

      {showUpsellDecisionDetails && response.upsell && (
        <UpsellDecisionDetails upsell={response.upsell} traceId={response.trace_id} />
      )}

      <AgentActivityStrip activity={agentActivity} />
    </div>
  );
}
