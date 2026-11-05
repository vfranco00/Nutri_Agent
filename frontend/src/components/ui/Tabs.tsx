import type { ComponentProps } from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "../../lib/utils";

/** Abas: a troca é instantânea, sem animação (só cor). */
export function Tabs(props: ComponentProps<typeof BaseTabs.Root>) {
  return <BaseTabs.Root {...props} />;
}

export function TabsList({ className, ...rest }: ComponentProps<typeof BaseTabs.List>) {
  return <BaseTabs.List className={cn("flex gap-1.5 overflow-x-auto", className)} {...rest} />;
}

export function TabsTab({ className, ...rest }: ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold text-mut",
        "data-active:bg-act-soft data-active:text-ink",
        "focus-visible:outline-2 focus-visible:outline-act-text",
        className,
      )}
      {...rest}
    />
  );
}

export function TabsPanel({ className, ...rest }: ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel className={cn("outline-none", className)} {...rest} />;
}
