import { useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { useToast } from "../../components/toastContext";
import { useCartStore } from "../../cart/cartStore";
import { TryOnFigure } from "./TryOnFigure";
import { TshirtThumbnail } from "./TshirtThumbnail";
import { TSHIRTS } from "./tshirts";

const SIZES = ["XS", "S", "M", "L", "XL"] as const;
type Size = (typeof SIZES)[number];

export function TryOnScreen() {
  const { showToast } = useToast();
  const addToCart = useCartStore((state) => state.addItem);
  const [selectedId, setSelectedId] = useState(TSHIRTS[0].id);
  const [size, setSize] = useState<Size>("M");

  const selected = TSHIRTS.find((item) => item.id === selectedId) ?? TSHIRTS[0];

  function handleAddToCart() {
    addToCart({
      sku: selected.id,
      name: selected.name,
      price_gbp: selected.price_gbp,
      image_url: null,
      size,
    });
    showToast(`Added ${selected.name} (${size}) to cart`);
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold">Try on a t-shirt</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pick a tee to see how it looks — a quick visual preview, not a photo of you.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {TSHIRTS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              aria-pressed={item.id === selectedId}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                item.id === selectedId
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <TshirtThumbnail item={item} size={72} />
              <span className="text-center text-xs font-medium leading-tight">{item.name}</span>
              <span className="text-xs text-neutral-500">£{item.price_gbp.toFixed(2)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-neutral-400">Virtual try-on</p>
          <TryOnFigure item={selected} />
          <p className="mt-3 text-sm font-semibold">{selected.name}</p>
          <p className="text-sm text-neutral-500">£{selected.price_gbp.toFixed(2)}</p>

          <div className="mt-3 flex gap-1.5">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                aria-pressed={s === size}
                className={`h-8 w-8 rounded-full text-xs font-medium transition ${
                  s === size
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <Button className="mt-4 w-full" onClick={handleAddToCart}>
            Add to cart
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
