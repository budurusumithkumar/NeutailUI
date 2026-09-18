import type { TshirtItem } from "./tshirts";

// Shared pattern rendering so the flat-lay thumbnail and the worn-on-figure
// preview draw identical colors/stripes/graphics, each clipped to their own
// shirt outline.
export function ShirtFill({ item, clipId }: { item: TshirtItem; clipId: string }) {
  const zigzagPatternId = `${clipId}-zigzag`;
  return (
    <g clipPath={`url(#${clipId})`}>
      {item.pattern === "zigzag" && item.accent && (
        <defs>
          <pattern id={zigzagPatternId} patternUnits="userSpaceOnUse" width="16" height="16">
            <path d="M0,8 L4,0 L8,8 L12,0 L16,8" stroke={item.accent} strokeWidth="2.5" fill="none" />
            <path d="M0,16 L4,8 L8,16 L12,8 L16,16" stroke={item.accent} strokeWidth="2.5" fill="none" />
          </pattern>
        </defs>
      )}
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
      {item.pattern === "zigzag" && item.accent && (
        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${zigzagPatternId})`} />
      )}
    </g>
  );
}
