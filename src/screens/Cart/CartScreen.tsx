import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { useCartStore, useCartSubtotal } from "../../cart/cartStore";
import type { CartItem } from "../../cart/types";

const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const UK_SIZES = [6, 8, 10, 12, 14, 16, 18, 20];

// Options for the size picker when the product didn't list its own sizes: numeric UK sizes ("12",
// "UK 12") get a UK range, everything else a letter range.
function fallbackSizes(size: string | null | undefined): string[] {
  const match = size?.trim().match(/^(UK\s*)?\d{1,2}$/i);
  if (!match) return LETTER_SIZES;
  return UK_SIZES.map((n) => `${match[1] ? "UK " : ""}${n}`);
}

function lineKey(item: CartItem): string {
  return `${item.sku}-${item.size ?? "nosize"}`;
}

export function CartScreen() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const changeSize = useCartStore((state) => state.changeSize);
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
          {items.map((item) => {
            const options = item.available_sizes?.length ? item.available_sizes : fallbackSizes(item.size);
            const choices = item.size && !options.includes(item.size) ? [item.size, ...options] : options;
            return (
              <div
                key={lineKey(item)}
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
                  <label className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                    Size
                    <select
                      value={item.size ?? ""}
                      onChange={(event) => changeSize(item.sku, item.size ?? null, event.target.value)}
                      className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-900"
                      aria-label={`Size for ${item.name}`}
                    >
                      {!item.size && (
                        <option value="" disabled>
                          Choose…
                        </option>
                      )}
                      {choices.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-1 text-sm font-semibold">£{item.price_gbp.toFixed(2)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="h-7 w-7 rounded-full border border-neutral-300 text-sm"
                    onClick={() => updateQuantity(item.sku, item.size ?? null, item.quantity - 1)}
                    aria-label={`Decrease quantity of ${item.name}`}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    className="h-7 w-7 rounded-full border border-neutral-300 text-sm"
                    onClick={() => updateQuantity(item.sku, item.size ?? null, item.quantity + 1)}
                    aria-label={`Increase quantity of ${item.name}`}
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
            );
          })}

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
