import { useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { useCartStore, useCartSubtotal } from "../../cart/cartStore";
import type { CartItem } from "../../cart/types";
import { BodyScanModal } from "./fit/BodyScanModal";
import { useBodyProfileStore } from "./fit/bodyProfileStore";
import { assessFit, defaultSizesFor, type FitVerdict } from "./fit/sizing";

const verdictStyles: Record<FitVerdict, string> = {
  good: "bg-emerald-50 text-emerald-700",
  roomy: "bg-sky-50 text-sky-700",
  snug: "bg-amber-50 text-amber-700",
  too_small: "bg-rose-50 text-rose-700",
  too_large: "bg-rose-50 text-rose-700",
  unknown: "bg-neutral-100 text-neutral-600",
};

export function CartScreen() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const changeSize = useCartStore((state) => state.changeSize);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = useCartSubtotal();
  const measurement = useBodyProfileStore((state) => state.measurement);
  const [scanOpen, setScanOpen] = useState(false);
  const yourSize = measurement
    ? `${measurement.size}${measurement.alternateSize ? ` / ${measurement.alternateSize}` : ""}`
    : "";

  const assessments = new Map(
    items.map((item) => [lineKey(item), measurement ? assessFit(item.size, measurement, item.available_sizes) : null]),
  );
  const atRiskCount = [...assessments.values()].filter((a) => a?.atRisk).length;

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold">Your cart</h1>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          Nothing here yet — ask your stylist for a recommendation to get started.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            {measurement ? (
              <div>
                <p className="text-sm font-medium">
                  Your estimated size: {yourSize}
                  <span className="ml-2 font-normal text-neutral-500">(chest ≈ {Math.round(measurement.chestCm)} cm)</span>
                </p>
                <p className={`mt-0.5 text-xs ${atRiskCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {atRiskCount > 0
                    ? `${atRiskCount} ${atRiskCount === 1 ? "item" : "items"} may not fit — adjust the size or remove it below.`
                    : "Everything in your cart should fit."}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Not sure about sizes?</p>
                <p className="text-xs text-neutral-500">
                  Use your camera to estimate your size and check each item fits before you buy.
                </p>
              </div>
            )}
            <Button variant={measurement ? "secondary" : "primary"} onClick={() => setScanOpen(true)}>
              {measurement ? "Rescan" : "Measure my size"}
            </Button>
          </div>

          {items.map((item) => {
            const assessment = assessments.get(lineKey(item)) ?? null;
            const sizeOptions = item.available_sizes?.length ? item.available_sizes : defaultSizesFor(item.size);
            const sizeChoices = item.size && !sizeOptions.includes(item.size) ? [item.size, ...sizeOptions] : sizeOptions;
            return (
              <div key={lineKey(item)} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-4">
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
                        {sizeChoices.map((size) => (
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

                {assessment && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${verdictStyles[assessment.verdict]}`}>
                      {assessment.label}
                    </span>
                    {assessment.verdict !== "good" && assessment.verdict !== "unknown" && measurement && (
                      <span className="text-xs text-neutral-500">
                        Your size is {yourSize}.
                      </span>
                    )}
                    {assessment.suggestedSize && (
                      <Button
                        variant="secondary"
                        className="ml-auto !px-3 !py-1 text-xs"
                        onClick={() => changeSize(item.sku, item.size ?? null, assessment.suggestedSize!)}
                      >
                        {item.size ? "Switch to" : "Use"} {assessment.suggestedSize}
                      </Button>
                    )}
                  </div>
                )}
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

      {scanOpen && <BodyScanModal onClose={() => setScanOpen(false)} />}
    </AppLayout>
  );
}

function lineKey(item: CartItem): string {
  return `${item.sku}-${item.size ?? "nosize"}`;
}
