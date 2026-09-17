import { ShirtFill } from "./ShirtFill";
import type { TshirtItem } from "./tshirts";

const WORN_SHIRT_PATH =
  "M48,58 L30,72 L38,96 L48,88 L46,182 L114,182 L112,88 L122,96 L130,72 L112,58 L92,68 L68,68 Z";

const SKIN = "#e3b98f";
const TROUSERS = "#3d4148";
const SHOES = "#1c1c1e";

// A stylized front-facing figure, not a photo — this is a client-side visual
// mockup (docs/03-api-integration.md, Gap #4), not real AR/photo-based try-on.
export function TryOnFigure({ item }: { item: TshirtItem }) {
  const clipId = `worn-clip-${item.id}`;
  return (
    <svg
      viewBox="0 0 160 320"
      width="100%"
      height="320"
      role="img"
      aria-label={`${item.name} shown on a stylized model figure`}
    >
      <circle cx="80" cy="30" r="22" fill={SKIN} />
      <rect x="72" y="48" width="16" height="14" fill={SKIN} />
      <rect x="28" y="90" width="16" height="90" rx="8" fill={SKIN} />
      <rect x="116" y="90" width="16" height="90" rx="8" fill={SKIN} />
      <rect x="50" y="180" width="26" height="120" rx="8" fill={TROUSERS} />
      <rect x="84" y="180" width="26" height="120" rx="8" fill={TROUSERS} />
      <rect x="46" y="296" width="34" height="14" rx="6" fill={SHOES} />
      <rect x="80" y="296" width="34" height="14" rx="6" fill={SHOES} />

      <defs>
        <clipPath id={clipId}>
          <path d={WORN_SHIRT_PATH} />
        </clipPath>
      </defs>
      <ShirtFill item={item} clipId={clipId} />
      <path d={WORN_SHIRT_PATH} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
    </svg>
  );
}
