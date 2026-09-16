import type { ChatResponse, ProductCard as ProductCardType } from "../../../api/types";
import { AgentActivityStrip } from "./AgentActivityStrip";
import { FitCard } from "./FitCard";
import { ProductCard } from "./ProductCard";
import { UpsellCard } from "./UpsellCard";

interface ChatTurnProps {
  response: ChatResponse;
  onAddToCart: (product: ProductCardType) => void;
  onAskFit: (product: ProductCardType) => void;
  onOpenDetail: (product: ProductCardType) => void;
}

// Implements the rendering algorithm in docs/04-chat-response-rendering.md:
// text always, then products / fit / upsell if present, then the activity strip.
export function ChatTurn({ response, onAddToCart, onAskFit, onOpenDetail }: ChatTurnProps) {
  const products = response.products ?? [];
  const agentActivity = response.agent_activity ?? [];
  const showUpsell =
    response.upsell?.eligible === true && response.upsell.action === "PRESENT_OFFER";

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

      {showUpsell && response.upsell && <UpsellCard upsell={response.upsell} />}

      <AgentActivityStrip activity={agentActivity} />
    </div>
  );
}
