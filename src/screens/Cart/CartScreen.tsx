import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { useCartStore, useCartSubtotal } from "../../cart/cartStore";

export function CartScreen() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = useCartSubtotal();

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold">Your cart</h1>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          Nothing here yet — ask your stylist for a recommendation to get started.
        </p>
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
                  onClick={() => updateQuantity(item.sku, item.size ?? null, item.quantity - 1)}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button
                  className="h-7 w-7 rounded-full border border-neutral-300 text-sm"
                  onClick={() => updateQuantity(item.sku, item.size ?? null, item.quantity + 1)}
                >
                  +
                </button>
              </div>

              <button
                className="text-xs text-neutral-400 hover:text-rose-600"
                onClick={() => removeItem(item.sku, item.size ?? null)}
              >
                Remove
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
            <span className="text-sm font-medium">Subtotal</span>
            <span className="text-lg font-semibold">£{subtotal.toFixed(2)}</span>
          </div>

          <Button className="w-full" disabled title="Checkout is coming soon">
            Checkout (coming soon)
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
