// Hardcoded catalog for the virtual try-on demo — there is no product/catalog
// endpoint in the OpenAPI contract (docs/03-api-integration.md, Gap #4), and this
// screen is a standalone styling toy, not the chat-driven discovery flow.
// Artwork is generated inline as SVG (see TshirtGraphics.tsx) rather than fetched
// images, so the catalog only needs color/pattern data, not image URLs.

export type TshirtPattern = "solid" | "striped" | "graphic";

export interface TshirtItem {
  id: string;
  name: string;
  price_gbp: number;
  color: string;
  accent?: string;
  pattern: TshirtPattern;
}

export const TSHIRTS: TshirtItem[] = [
  { id: "tee-01", name: "Classic White Tee", price_gbp: 18, color: "#f7f5f2", pattern: "solid" },
  { id: "tee-02", name: "Midnight Black Tee", price_gbp: 18, color: "#1c1c1e", pattern: "solid" },
  { id: "tee-03", name: "Ocean Blue Tee", price_gbp: 20, color: "#2f6fb0", pattern: "solid" },
  {
    id: "tee-04",
    name: "Sunset Stripe Tee",
    price_gbp: 22,
    color: "#f2c14e",
    accent: "#d9502c",
    pattern: "striped",
  },
  { id: "tee-05", name: "Forest Green Tee", price_gbp: 19, color: "#3a6b4c", pattern: "solid" },
  { id: "tee-06", name: "Blush Pink Tee", price_gbp: 19, color: "#e8b4bc", pattern: "solid" },
  {
    id: "tee-07",
    name: "Retro Sun Graphic Tee",
    price_gbp: 24,
    color: "#efe6d8",
    accent: "#d94f30",
    pattern: "graphic",
  },
  { id: "tee-08", name: "Charcoal Grey Tee", price_gbp: 18, color: "#4b4f56", pattern: "solid" },
  { id: "tee-09", name: "Navy Blue Tee", price_gbp: 19, color: "#1f2f4d", pattern: "solid" },
  { id: "tee-10", name: "Mustard Yellow Tee", price_gbp: 19, color: "#d9a52c", pattern: "solid" },
  { id: "tee-11", name: "Burgundy Tee", price_gbp: 20, color: "#6e2635", pattern: "solid" },
  { id: "tee-12", name: "Lavender Tee", price_gbp: 19, color: "#c3b6de", pattern: "solid" },
  {
    id: "tee-13",
    name: "Coastal Stripe Tee",
    price_gbp: 22,
    color: "#eef0ec",
    accent: "#2f6fb0",
    pattern: "striped",
  },
  {
    id: "tee-14",
    name: "Varsity Circle Tee",
    price_gbp: 24,
    color: "#3a6b4c",
    accent: "#f2c14e",
    pattern: "graphic",
  },
];
