import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureSession } from "../../api/ensureSession";
import { getCustomerSummary } from "../../api/customer";
import { getHomeRecommendations } from "../../api/recommendations";
import {
  recordProductView,
  recordUpsellDecisionEvent,
} from "../../api/upsell";
import type {
  ProductCard as ProductCardType,
  UpsellDecisionEventType,
  UpsellResult,
} from "../../api/types";
import { useAuthStore } from "../../auth/authStore";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { useToast } from "../../components/toastContext";
import { useCartCount, useCartStore, useCartSubtotal } from "../../cart/cartStore";
import { ProductCard } from "../Chat/components/ProductCard";
import { ProductDetailModal } from "../Chat/components/ProductDetailModal";
import {
  UpsellCard,
  type UpsellUserAction,
} from "../Chat/components/UpsellCard";

const upsellEventType: Record<UpsellUserAction, UpsellDecisionEventType> = {
  ACCEPTED: "OFFER_ACCEPTED",
  DECLINED: "OFFER_DECLINED",
  DISMISSED: "OFFER_DISMISSED",
};

interface HomeUpsell {
  result: UpsellResult;
  sessionId: string;
  traceId: string;
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const addToCart = useCartStore((state) => state.addItem);
  const [startingChat, setStartingChat] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductCardType | null>(null);
  const [homeUpsell, setHomeUpsell] = useState<HomeUpsell | null>(null);
  const [isRecordingUpsellAction, setIsRecordingUpsellAction] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["customer", "summary"],
    queryFn: getCustomerSummary,
  });
  const recommendationsQuery = useQuery({
    queryKey: ["recommendations", "home"],
    queryFn: () => getHomeRecommendations(8),
    staleTime: 2 * 60 * 1000,
  });

  const cartCount = useCartCount();
  const cartSubtotal = useCartSubtotal();

  async function handleStartChat() {
    setStartingChat(true);
    try {
      await ensureSession();
      navigate("/chat");
    } catch {
      showToast("Couldn't reach Neu.Tail. Please try again.", "error");
    } finally {
      setStartingChat(false);
    }
  }

  function handleAddToCart(product: ProductCardType) {
    addToCart({
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      price_gbp: product.price_gbp,
      image_url: product.image_url,
    });
    showToast(`Added ${product.name} to cart`);
  }

  function handleOpenDetail(
    product: ProductCardType,
    recommendationId: string,
    sectionId: string,
    rank: number,
  ) {
    setDetailProduct(product);
    const idempotencyKey = `home-product-view-${crypto.randomUUID()}`;

    void ensureSession()
      .then(async (sessionId) => {
        const engagement = await recordProductView(sessionId, product.sku, {
          idempotencyKey,
          metadata: {
            source: "HOME_RECOMMENDATIONS",
            recommendation_id: recommendationId,
            section_id: sectionId,
            rank,
          },
        });
        const upsell = engagement.upsell_result;
        if (
          upsell?.status === "OFFER_AVAILABLE" &&
          upsell.should_offer &&
          upsell.decision_id
        ) {
          setHomeUpsell({
            result: upsell,
            sessionId,
            traceId: engagement.trace_id,
          });
        }
      })
      .catch(() => {
        showToast("The product opened, but its view could not be recorded.", "error");
      });
  }

  async function handleAskFit(product: ProductCardType) {
    setDetailProduct(null);
    try {
      await ensureSession();
      navigate("/chat", {
        state: {
          selectedSku: product.sku,
          draft: `Will ${product.name} fit me in size ${product.available_sizes?.[0] ?? ""}?`.trim(),
        },
      });
    } catch {
      showToast("Couldn't start a fit conversation. Please try again.", "error");
    }
  }

  async function handleUpsellRespond(action: UpsellUserAction): Promise<boolean> {
    if (!homeUpsell?.result.decision_id) return false;

    setIsRecordingUpsellAction(true);
    try {
      const response = await recordUpsellDecisionEvent(
        homeUpsell.result.decision_id,
        homeUpsell.sessionId,
        upsellEventType[action],
      );
      if (response.recorded) {
        showToast(response.message);
      }
      return response.recorded;
    } catch {
      showToast("Your response could not be recorded. Please try again.", "error");
      return false;
    } finally {
      setIsRecordingUpsellAction(false);
    }
  }

  const summary = summaryQuery.data;
  const recommendations = recommendationsQuery.data;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Hi {summary?.display_name ?? user?.display_name ?? "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your stylist is ready whenever you are.
          </p>
        </div>

        <Button onClick={handleStartChat} disabled={startingChat}>
          {startingChat ? "Starting…" : "Chat with your stylist"}
        </Button>

        {summaryQuery.isLoading && (
          <p className="text-sm text-neutral-500">Loading your profile…</p>
        )}

        {summary && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              {summary.segment && <Chip tone="success">{summary.segment}</Chip>}
              {summary.loyalty_status && <Chip>{summary.loyalty_status} customer</Chip>}
              {summary.loyalty_tier && <Chip tone="success">{summary.loyalty_tier} tier</Chip>}
              {typeof summary.points_balance === "number" && (
                <Chip>{summary.points_balance} points</Chip>
              )}
              {summary.usual_size && <Chip>Usual size: {summary.usual_size}</Chip>}
            </div>

            {summary.previous_segment && summary.segment_changed_at && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Profile refreshed: {summary.previous_segment} → {summary.segment} after {summary.purchase_count_90d ?? 0} recent purchases.
              </p>
            )}

            {summary.preferred_styles.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-neutral-400">
                  Styles you love
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.preferred_styles.map((style) => (
                    <Chip key={style}>{style}</Chip>
                  ))}
                </div>
              </div>
            )}

            {summary.preferred_colors.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-neutral-400">
                  Colors you love
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.preferred_colors.map((color) => (
                    <Chip key={color}>{color}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <section aria-labelledby="home-recommendations-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="home-recommendations-title" className="text-lg font-semibold">
                Recommended for you
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                In-stock picks based on your categories and style preferences.
              </p>
            </div>
            {recommendationsQuery.isError && (
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                onClick={() => void recommendationsQuery.refetch()}
              >
                Try again
              </Button>
            )}
          </div>

          {recommendationsQuery.isLoading && (
            <div className="mt-3 flex gap-3 overflow-hidden" aria-label="Loading recommendations">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-80 w-56 shrink-0 animate-pulse rounded-xl bg-neutral-100"
                />
              ))}
            </div>
          )}

          {recommendationsQuery.isError && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              We couldn't load your recommendations right now.
            </p>
          )}

          {recommendations?.status === "NO_RESULTS" && (
            <p className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              No in-stock matches are available in your preferred categories yet.
            </p>
          )}

          {recommendations?.sections.map((section) => (
            <div key={section.section_id} className="mt-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-800">{section.title}</h3>
                {section.category && <Chip>{section.category}</Chip>}
              </div>
              <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
                {section.products.map((product, index) => (
                  <ProductCard
                    key={product.sku}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onAskFit={(item) => void handleAskFit(item)}
                    onOpenDetail={(item) =>
                      handleOpenDetail(
                        item,
                        recommendations.recommendation_id,
                        section.section_id,
                        index + 1,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        {homeUpsell && (
          <section aria-label="Optional Neu.Tail service">
            <UpsellCard
              upsell={homeUpsell.result}
              sessionId={homeUpsell.sessionId}
              traceId={homeUpsell.traceId}
              disabled={isRecordingUpsellAction}
              onRespond={handleUpsellRespond}
            />
          </section>
        )}

        <button
          onClick={() => navigate("/cart")}
          className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:border-neutral-300"
        >
          <div>
            <p className="text-sm font-medium">Your cart</p>
            <p className="text-xs text-neutral-500">
              {cartCount === 0 ? "No items yet" : `${cartCount} item${cartCount === 1 ? "" : "s"}`}
            </p>
          </div>
          {cartCount > 0 && (
            <p className="text-sm font-semibold">£{cartSubtotal.toFixed(2)}</p>
          )}
        </button>
      </div>

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onAddToCart={(product) => {
            handleAddToCart(product);
            setDetailProduct(null);
          }}
          onAskFit={(product) => void handleAskFit(product)}
        />
      )}
    </AppLayout>
  );
}
