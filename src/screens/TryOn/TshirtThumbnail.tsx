import { ShirtFill } from "./ShirtFill";
import type { TshirtItem } from "./tshirts";

const FLAT_SHIRT_PATH =
  "M30,10 L45,10 L60,0 L75,10 L90,10 L100,32 L84,42 L82,108 L38,108 L36,42 L20,32 Z";

export function TshirtThumbnail({ item, size = 96 }: { item: TshirtItem; size?: number }) {
  const clipId = `flat-clip-${item.id}`;
  return (
    <svg viewBox="0 0 120 118" width={size} height={size} role="img" aria-label={item.name}>
      <defs>
        <clipPath id={clipId}>
          <path d={FLAT_SHIRT_PATH} />
        </clipPath>
      </defs>
      <ShirtFill item={item} clipId={clipId} />
      <path d={FLAT_SHIRT_PATH} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
    </svg>
  );
}
