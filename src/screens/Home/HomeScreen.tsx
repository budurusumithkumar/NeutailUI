import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureSession } from "../../api/ensureSession";
import { getCustomerSummary } from "../../api/customer";
import { useAuthStore } from "../../auth/authStore";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { useToast } from "../../components/toastContext";
import { useCartCount, useCartSubtotal } from "../../cart/cartStore";

export function HomeScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const [startingChat, setStartingChat] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["customer", "summary"],
    queryFn: getCustomerSummary,
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

  const summary = summaryQuery.data;

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
              {summary.loyalty_tier && <Chip tone="success">{summary.loyalty_tier} tier</Chip>}
              {typeof summary.points_balance === "number" && (
                <Chip>{summary.points_balance} points</Chip>
              )}
              {summary.usual_size && <Chip>Usual size: {summary.usual_size}</Chip>}
            </div>

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
    </AppLayout>
  );
}
