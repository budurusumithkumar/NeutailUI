import { ShirtFill } from "./ShirtFill";
import { FLAT_SHIRT_PATH } from "./shirtPaths";
import type { TshirtItem } from "./tshirts";

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
