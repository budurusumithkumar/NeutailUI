// Shared shirt outline paths, used both for the flat-lay grid thumbnails and
// the camera-overlay preview (CameraTryOn.tsx).

export const FLAT_SHIRT_PATH =
  "M30,10 L45,10 L60,0 L75,10 L90,10 L100,32 L84,42 L82,108 L38,108 L36,42 L20,32 Z";

// A worn-shirt silhouette (shoulders/sleeves/tapered torso), tightly framed by
// OVERLAY_SHIRT_VIEWBOX so its visual center lines up with the SVG's own
// center — needed for the drag/scale math in CameraTryOn.
export const WORN_SHIRT_PATH =
  "M48,58 L30,72 L38,96 L48,88 L46,182 L114,182 L112,88 L122,96 L130,72 L112,58 L92,68 L68,68 Z";

export const OVERLAY_SHIRT_VIEWBOX = "20 48 120 144";
