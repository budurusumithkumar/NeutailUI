import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { postChat } from "../../api/chat";
import { ensureSession } from "../../api/ensureSession";
import type { ChatRequest, ErrorResponse, ProductCard as ProductCardType } from "../../api/types";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { useToast } from "../../components/toastContext";
import { useCartStore } from "../../cart/cartStore";
import { ChatTurn } from "./components/ChatTurn";
import { ProductDetailModal } from "./components/ProductDetailModal";
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

export function ChatScreen() {
  const { showToast } = useToast();
  const addToCart = useCartStore((state) => state.addItem);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [input, setInput] = useState("");
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductCardType | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureSession()
      .then((id) => {
        setSessionId(id);
        setTranscript(loadTranscript(id));
      })
      .catch(() => {
        showToast("Couldn't reach Neu.Tail. Please try again.", "error");
      });
  }, [showToast]);

  useEffect(() => {
    if (sessionId) {
      saveTranscript(sessionId, transcript);
    }
  }, [sessionId, transcript]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  async function sendMessage(text: string, selectedSku: string | null) {
    if (!sessionId || !text.trim()) return;

    const userEntry: TranscriptEntry = { id: crypto.randomUUID(), kind: "user", text };
    setTranscript((current) => [...current, userEntry]);
    setInput("");
    setPendingSku(null);
    setIsSending(true);

    const resultEntry = await runChat({ session_id: sessionId, message: text, selected_sku: selectedSku });
    setTranscript((current) => [...current, resultEntry]);
    setIsSending(false);
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
    });
    showToast(`Added ${product.name} to cart`);
  }

  function handleAskFit(product: ProductCardType) {
    setDetailProduct(null);
    setPendingSku(product.sku);
    setInput(`Will this fit me in size ${product.available_sizes?.[0] ?? ""}?`.trim());
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-140px)] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {transcript.length === 0 && (
            <p className="text-sm text-neutral-400">
              Tell your stylist what you're looking for — e.g. "I need a dress for a wedding".
            </p>
          )}

          {transcript.map((entry) => {
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
                  onOpenDetail={setDetailProduct}
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
            sendMessage(input, pendingSku);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask your stylist anything…"
            disabled={!sessionId || isSending}
            className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-neutral-500 focus:outline-none disabled:bg-neutral-50"
          />
          <Button type="submit" disabled={!sessionId || isSending || !input.trim()}>
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
