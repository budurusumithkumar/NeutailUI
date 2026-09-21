import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { postChat } from "../../api/chat";
import { ensureSession } from "../../api/ensureSession";
import {
  recordProductView,
  recordUpsellDecisionEvent,
} from "../../api/upsell";
import type {
  AgentActivity,
  ChatRequest,
  EngagementEventResponse,
  ErrorResponse,
  ProductCard as ProductCardType,
  UpsellDecisionEventType,
  UpsellResult,
} from "../../api/types";
import { useAuthStore } from "../../auth/authStore";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { useToast } from "../../components/toastContext";
import { useCartStore } from "../../cart/cartStore";
import { ChatTurn } from "./components/ChatTurn";
import { ProductDetailModal } from "./components/ProductDetailModal";
import type { UpsellUserAction } from "./components/UpsellCard";
import { loadTranscript, saveTranscript } from "./transcriptCache";
import type { TranscriptEntry } from "./types";

function extractErrorMessage(error: unknown): string {
  if (isAxiosError<ErrorResponse>(error) && error.response?.data?.message) {
    return error.response.data.message;
  }
  return "Couldn't reach Neu.Tail. Please try again.";
}

async function runChat(payload: ChatRequest): Promise<TranscriptEntry> {
  try {
    const response = await postChat(payload);
    return { id: crypto.randomUUID(), kind: "assistant", response };
  } catch (error) {
    return {
      id: crypto.randomUUID(),
      kind: "assistant-error",
      text: extractErrorMessage(error),
      retryPayload: payload,
    };
  }
}

function upsellActionMessage(
  upsell: UpsellResult,
  action: UpsellUserAction,
): string {
  const offerName =
    upsell.offer?.title ??
    upsell.offer?.offer_type.replaceAll("_", " ").toLowerCase() ??
    "this service";

  if (action === "DECLINED") {
    return `No thanks, I don't want the ${offerName} offer.`;
  }
  if (action === "DISMISSED") {
    return `Not right now for ${offerName}.`;
  }
  if (upsell.offer?.offer_type === "STYLING_ADVISORY") {
    return `I'd like to use ${offerName}.`;
  }
  return `I'm interested in ${offerName}. Please show me the next steps; do not enroll me automatically.`;
}

const upsellEventType: Record<UpsellUserAction, UpsellDecisionEventType> = {
  ACCEPTED: "OFFER_ACCEPTED",
  DECLINED: "OFFER_DECLINED",
  DISMISSED: "OFFER_DISMISSED",
};

const EMPTY_TRANSCRIPT: TranscriptEntry[] = [];

function engagementUpsellEntry(
  engagement: EngagementEventResponse,
  sessionId: string,
): TranscriptEntry | null {
  const upsell = engagement.upsell_result;
  if (!upsell) return null;

  const agents = [engagement.trigger?.source_agent, "upsell_agent"].filter(
    (agent, index, all): agent is string => Boolean(agent) && all.indexOf(agent) === index,
  );
  const agentActivity: AgentActivity[] = agents.map((agent) => ({
    agent,
    status:
      agent === "upsell_agent" && upsell.status === "FAILED"
        ? "FAILED"
        : "COMPLETED",
    duration_ms: null,
  }));

  return {
    id: crypto.randomUUID(),
    kind: "assistant",
    response: {
      trace_id: engagement.trace_id,
      session_id: sessionId,
      intent: "SERVICE_QUERY",
      message: "",
      products: [],
      fit: null,
      upsell,
      agent_activity: agentActivity,
    },
  };
}

export function ChatScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const customerId = useAuthStore((state) => state.user?.customer_id);
  const addToCart = useCartStore((state) => state.addItem);
  const navigationState = location.state as
    | { selectedSku?: unknown; draft?: unknown }
    | null;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [input, setInput] = useState(() =>
    typeof navigationState?.draft === "string" ? navigationState.draft : "",
  );
  const [pendingSku, setPendingSku] = useState<string | null>(() =>
    typeof navigationState?.selectedSku === "string"
      ? navigationState.selectedSku
      : null,
  );
  const [isSending, setIsSending] = useState(false);
  const [isRecordingUpsellAction, setIsRecordingUpsellAction] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductCardType | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const productViewKeysRef = useRef(new Map<string, string>());
  const sessionMatchesCustomer = sessionOwnerId === customerId;
  const activeSessionId = sessionMatchesCustomer ? sessionId : null;
  const activeTranscript = sessionMatchesCustomer ? transcript : EMPTY_TRANSCRIPT;

  useEffect(() => {
    if (!customerId) return;

    let cancelled = false;

    ensureSession(customerId)
      .then((id) => {
        if (cancelled) return;
        setSessionOwnerId(customerId);
        setSessionId(id);
        setTranscript(loadTranscript(id));
      })
      .catch(() => {
        if (cancelled) return;
        showToast("Couldn't reach Neu.Tail. Please try again.", "error");
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, showToast]);

  useEffect(() => {
    if (sessionId) {
      saveTranscript(sessionId, transcript);
    }
  }, [sessionId, transcript]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTranscript]);

  useEffect(() => {
    if (!navigationState) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, navigationState]);

  async function sendMessage(text: string, selectedSku: string | null): Promise<boolean> {
    if (!activeSessionId || !text.trim()) return false;

    const userEntry: TranscriptEntry = { id: crypto.randomUUID(), kind: "user", text };
    setTranscript((current) => [...current, userEntry]);
    setInput("");
    setPendingSku(null);
    setIsSending(true);

    const resultEntry = await runChat({
      session_id: activeSessionId,
      message: text,
      selected_sku: selectedSku,
    });
    setTranscript((current) => [...current, resultEntry]);
    setIsSending(false);
    return resultEntry.kind === "assistant";
  }

  async function handleRetry(entryId: string, payload: ChatRequest) {
    setIsSending(true);
    const resultEntry = await runChat(payload);
    setTranscript((current) =>
      current.map((entry) => (entry.id === entryId ? resultEntry : entry)),
    );
    setIsSending(false);
  }

  function handleAddToCart(product: ProductCardType) {
    addToCart({
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      price_gbp: product.price_gbp,
      image_url: product.image_url,
      available_sizes: product.available_sizes,
    });
    showToast(`Added ${product.name} to cart`);
  }

  function handleAskFit(product: ProductCardType) {
    setDetailProduct(null);
    setPendingSku(product.sku);
    setInput(`Will this fit me in size ${product.available_sizes?.[0] ?? ""}?`.trim());
  }

  function handleOpenDetail(product: ProductCardType) {
    setDetailProduct(product);
    if (!activeSessionId) return;

    const attemptKey = `${activeSessionId}:${product.sku}`;
    const idempotencyKey =
      productViewKeysRef.current.get(attemptKey) ??
      `chat-product-view-${crypto.randomUUID()}`;
    productViewKeysRef.current.set(attemptKey, idempotencyKey);

    void recordProductView(activeSessionId, product.sku, { idempotencyKey })
      .then((engagement) => {
        productViewKeysRef.current.delete(attemptKey);
        const entry = engagementUpsellEntry(engagement, activeSessionId);
        if (!entry || entry.kind !== "assistant") return;

        setTranscript((current) => {
          const decisionId = entry.response.upsell?.decision_id;
          const alreadyPresent = current.some(
            (item) =>
              item.kind === "assistant" &&
              ((engagement.trace_id &&
                item.response.trace_id === engagement.trace_id) ||
                (decisionId && item.response.upsell?.decision_id === decisionId)),
          );
          return alreadyPresent ? current : [...current, entry];
        });
      })
      .catch((error: unknown) => {
        showToast(extractErrorMessage(error), "error");
      });
  }

  async function handleUpsellRespond(
    upsell: UpsellResult,
    action: UpsellUserAction,
  ): Promise<boolean> {
    if (!activeSessionId) return false;

    if (!upsell.decision_id) {
      return sendMessage(upsellActionMessage(upsell, action), null);
    }

    setIsRecordingUpsellAction(true);
    try {
      const result = await recordUpsellDecisionEvent(
        upsell.decision_id,
        activeSessionId,
        upsellEventType[action],
      );
      if (result.recorded && result.message) {
        showToast(result.message);
      }
      return result.recorded;
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
      return false;
    } finally {
      setIsRecordingUpsellAction(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-140px)] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {activeTranscript.length === 0 && (
            <p className="text-sm text-neutral-400">
              Tell your stylist what you're looking for — e.g. "I need a dress for a wedding".
            </p>
          )}

          {activeTranscript.map((entry) => {
            if (entry.kind === "user") {
              return (
                <div key={entry.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm text-white">
                    {entry.text}
                  </div>
                </div>
              );
            }
            if (entry.kind === "assistant") {
              return (
                <ChatTurn
                  key={entry.id}
                  response={entry.response}
                  onAddToCart={handleAddToCart}
                  onAskFit={handleAskFit}
                  onOpenDetail={handleOpenDetail}
                  onUpsellRespond={handleUpsellRespond}
                  upsellActionPending={isSending || isRecordingUpsellAction}
                />
              );
            }
            return (
              <div key={entry.id} className="max-w-[85%] space-y-2">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {entry.text}
                </div>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={isSending}
                  onClick={() => handleRetry(entry.id, entry.retryPayload)}
                >
                  Retry
                </Button>
              </div>
            );
          })}
          <div ref={transcriptEndRef} />
        </div>

        <form
          className="mt-2 flex gap-2 border-t border-neutral-200 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input, pendingSku);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask your stylist anything…"
            disabled={!activeSessionId || isSending}
            className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-neutral-500 focus:outline-none disabled:bg-neutral-50"
          />
          <Button type="submit" disabled={!activeSessionId || isSending || !input.trim()}>
            Send
          </Button>
        </form>
      </div>

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onAddToCart={(product) => {
            handleAddToCart(product);
            setDetailProduct(null);
          }}
          onAskFit={handleAskFit}
        />
      )}
    </AppLayout>
  );
}
