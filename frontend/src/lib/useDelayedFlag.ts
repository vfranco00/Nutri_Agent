import { useEffect, useState } from "react";

/** `true` só depois de `delayMs` com `active` ligado; volta a `false` na hora em que `active` desliga. */
export function useDelayedFlag(active: boolean, delayMs = 300): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setOn(true), delayMs);
    return () => {
      clearTimeout(t);
      setOn(false);
    };
  }, [active, delayMs]);
  return active && on;
}
