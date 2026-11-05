import { useDelayedFlag } from "../../lib/useDelayedFlag";
import { NuviSlice } from "./NuviSlice";

export interface NuviLoaderProps {
  active: boolean;
  size?: number;
  label: string;
}

/** A onda de carregamento; só aparece se a espera passar de 300 ms. */
export function NuviLoader({ active, size = 40, label }: NuviLoaderProps) {
  const show = useDelayedFlag(active, 300);
  if (!show) return null;
  return (
    <div role="status" aria-live="polite" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <NuviSlice size={size} wave />
      <span className="sr-only">{label}</span>
    </div>
  );
}
