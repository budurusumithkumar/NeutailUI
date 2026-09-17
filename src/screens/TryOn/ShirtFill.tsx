import type { TshirtItem } from "./tshirts";

// Shared pattern rendering so the flat-lay thumbnail and the worn-on-figure
// preview draw identical colors/stripes/graphics, each clipped to their own
// shirt outline.
export function ShirtFill({ item, clipId }: { item: TshirtItem; clipId: string }) {
  return (
    <g clipPath={`url(#${clipId})`}>
      <rect x="0" y="0" width="100%" height="100%" fill={item.color} />
      {item.pattern === "striped" && item.accent && (
        <>
          <rect x="0" y="22%" width="100%" height="10%" fill={item.accent} />
          <rect x="0" y="48%" width="100%" height="10%" fill={item.accent} />
          <rect x="0" y="74%" width="100%" height="10%" fill={item.accent} />
        </>
      )}
      {item.pattern === "graphic" && item.accent && (
        <circle cx="50%" cy="48%" r="16%" fill={item.accent} />
      )}
    </g>
  );
}
