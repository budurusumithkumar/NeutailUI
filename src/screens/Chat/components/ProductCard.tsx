import type { ProductCard as ProductCardType } from "../../../api/types";
import { Button } from "../../../components/Button";
import { Chip } from "../../../components/Chip";

interface ProductCardProps {
  product: ProductCardType;
  onAddToCart: (product: ProductCardType) => void;
  onAskFit: (product: ProductCardType) => void;
  onOpenDetail: (product: ProductCardType) => void;
}

export function ProductCard({ product, onAddToCart, onAskFit, onOpenDetail }: ProductCardProps) {
  return (
    <div className="w-56 shrink-0 rounded-xl border border-neutral-200 bg-white p-3">
      <button
        onClick={() => onOpenDetail(product)}
        className="block w-full text-left"
      >
        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-neutral-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-stone-100 to-neutral-200 px-4 text-center">
              <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
                Neu.Tail
              </span>
              <span className="mt-2 text-sm font-semibold text-neutral-700">
                {product.category ?? "Curated style"}
              </span>
              {(product.color || product.style) && (
                <span className="mt-1 text-xs text-neutral-500">
                  {[product.color, product.style].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-sm font-medium leading-tight">{product.name}</p>
        {product.brand && <p className="text-xs text-neutral-500">{product.brand}</p>}
        <p className="mt-1 text-sm font-semibold">£{product.price_gbp.toFixed(2)}</p>
      </button>

      {!product.available && (
        <Chip tone="warning">Out of stock</Chip>
      )}

      <div className="mt-2 flex gap-1.5">
        <Button
          variant="primary"
          className="flex-1 px-2 py-1.5 text-xs"
          disabled={!product.available}
          onClick={() => onAddToCart(product)}
        >
          Add to cart
        </Button>
        <Button
          variant="secondary"
          className="flex-1 px-2 py-1.5 text-xs"
          onClick={() => onAskFit(product)}
        >
          Will it fit?
        </Button>
      </div>
    </div>
  );
}
