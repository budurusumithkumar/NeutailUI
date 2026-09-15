// Client-only model — no backend schema exists for cart yet (docs/03-api-integration.md, Gap #1).

export interface CartItem {
  sku: string;
  name: string;
  brand?: string | null;
  price_gbp: number;
  image_url?: string | null;
  size?: string | null;
  quantity: number;
}
