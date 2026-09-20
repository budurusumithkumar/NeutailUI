// Client-only model — no backend schema exists for cart yet (docs/03-api-integration.md, Gap #1).

export interface CartItem {
  sku: string;
  name: string;
  brand?: string | null;
  price_gbp: number;
  image_url?: string | null;
  size?: string | null;
  /** Sizes the product is offered in, when known — drives the size-change picker in the cart. */
  available_sizes?: string[];
  quantity: number;
}
