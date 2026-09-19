import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { completeDemoCheckout } from "../../api/purchases";
import type { DemoCheckoutRequest, PurchaseEventResult } from "../../api/types";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { useToast } from "../../components/toastContext";
import { useCartStore, useCartSubtotal } from "../../cart/cartStore";

export function CartScreen() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clear);
  const subtotal = useCartSubtotal();
  const [checkoutAttempt, setCheckoutAttempt] = useState<DemoCheckoutRequest | null>(null);
  const [completedPurchase, setCompletedPurchase] = useState<PurchaseEventResult | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: completeDemoCheckout,
    onSuccess: async (result) => {
      setCompletedPurchase(result);
      setCheckoutAttempt(null);
      clearCart();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["recommendations", "home"] }),
      ]);
      showToast(
        result.transition.changed
          ? `Profile updated to ${result.transition.new_segment}`
          : "Purchase completed",
      );
    },
    onError: () => {
      showToast("Checkout could not be completed. You can safely retry.", "error");
    },
  });

  function handleCheckout() {
    const request =
      checkoutAttempt ??
      {
        idempotency_key: `demo-checkout-${crypto.randomUUID()}`,
        occurred_at: new Date().toISOString(),
        items: items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          size: item.size,
        })),
      };
    setCheckoutAttempt(request);
    checkoutMutation.mutate(request);
  }

  function resetAttempt() {
    if (checkoutAttempt) setCheckoutAttempt(null);
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold">Your cart</h1>

      {items.length === 0 ? (
        completedPurchase ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-emerald-950">Purchase complete</h2>
              <Chip tone="success">{completedPurchase.purchase_count_90d} purchases in 90 days</Chip>
            </div>
            <p className="mt-2 text-sm text-emerald-900">
              Order {completedPurchase.order_id} has been committed.
            </p>
            {completedPurchase.transition.changed && (
              <div className="mt-4 rounded-xl bg-white p-4 text-sm text-neutral-700">
                <p className="font-medium">Your profile has been refreshed</p>
                <p className="mt-1">
                  {completedPurchase.transition.previous_segment ?? "New customer"}
                  {" → "}
                  <span className="font-semibold">{completedPurchase.transition.new_segment}</span>
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Loyalty status: {completedPurchase.transition.new_loyalty_status}. Profile version {completedPurchase.profile_version}.
                </p>
              </div>
            )}
            <p className="mt-3 text-xs text-emerald-800">
              Points remain unchanged because this demo does not simulate a loyalty accrual transaction.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            Nothing here yet — ask your stylist for a recommendation to get started.
          </p>
        )
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={`${item.sku}-${item.size ?? "nosize"}`}
              className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                {item.brand && <p className="text-xs text-neutral-500">{item.brand}</p>}
                {item.size && <p className="text-xs text-neutral-500">Size {item.size}</p>}
                <p className="mt-1 text-sm font-semibold">£{item.price_gbp.toFixed(2)}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="h-7 w-7 rounded-full border border-neutral-300 text-sm"
                  onClick={() => {
                    resetAttempt();
                    updateQuantity(item.sku, item.size ?? null, item.quantity - 1);
                  }}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button
                  className="h-7 w-7 rounded-full border border-neutral-300 text-sm"
                  onClick={() => {
                    resetAttempt();
                    updateQuantity(item.sku, item.size ?? null, item.quantity + 1);
                  }}
                >
                  +
                </button>
              </div>

              <button
                className="text-xs text-neutral-400 hover:text-rose-600"
                onClick={() => {
                  resetAttempt();
                  removeItem(item.sku, item.size ?? null);
                }}
              >
                Remove
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
            <span className="text-sm font-medium">Subtotal</span>
            <span className="text-lg font-semibold">£{subtotal.toFixed(2)}</span>
          </div>

          <Button
            className="w-full"
            disabled={checkoutMutation.isPending}
            onClick={handleCheckout}
          >
            {checkoutMutation.isPending ? "Completing purchase…" : "Complete demo purchase"}
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
