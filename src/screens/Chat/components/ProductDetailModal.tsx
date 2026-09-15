import type { ProductCard } from "../../../api/types";
import { Button } from "../../../components/Button";
import { Chip } from "../../../components/Chip";

interface ProductDetailModalProps {
  product: ProductCard;
  onClose: () => void;
  onAddToCart: (product: ProductCard) => void;
  onAskFit: (product: ProductCard) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onAskFit,
}: ProductDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{product.name}</h2>
            {product.brand && <p className="text-sm text-neutral-500">{product.brand}</p>}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="mt-4 aspect-[3/4] w-full rounded-xl object-cover"
          />
        )}

        <p className="mt-4 text-xl font-semibold">£{product.price_gbp.toFixed(2)}</p>

        {product.reason_codes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.reason_codes.map((code) => (
              <Chip key={code}>{code.replaceAll("_", " ").toLowerCase()}</Chip>
            ))}
          </div>
        )}

        {product.available_sizes && product.available_sizes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase text-neutral-400">Available sizes</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {product.available_sizes.map((size) => (
                <Chip key={size}>{size}</Chip>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            className="flex-1"
            disabled={!product.available}
            onClick={() => onAddToCart(product)}
          >
            Add to cart
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => onAskFit(product)}>
            Will it fit?
          </Button>
        </div>
      </div>
    </div>
  );
}
