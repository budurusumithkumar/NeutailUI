import { AdvancedBodyScanModal } from "./AdvancedBodyScanModal";
import { ShoulderScanModal } from "./ShoulderScanModal";

// The default scan is the original quick shoulder-width one. The slower face-scale + torso scan (two scans,
// camera-level check, etc.) is still in the tree: open the cart with `?scan=advanced` to use it.
function useAdvancedScan(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("scan") === "advanced";
  } catch {
    return false;
  }
}

export function BodyScanModal({ onClose }: { onClose: () => void }) {
  return useAdvancedScan() ? <AdvancedBodyScanModal onClose={onClose} /> : <ShoulderScanModal onClose={onClose} />;
}
