import { cn } from "../../lib/utils";

/** Esqueleto de carregamento; só opacidade, e parado com movimento reduzido. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-soft", className)} />;
}
