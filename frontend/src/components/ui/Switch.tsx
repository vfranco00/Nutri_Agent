import type { ComponentProps } from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../../lib/utils";

export function Switch({ className, ...rest }: ComponentProps<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-line p-0.5",
        "data-checked:bg-act focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-act-text",
        className,
      )}
      {...rest}
    >
      <BaseSwitch.Thumb className="block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-[140ms] ease-out data-checked:translate-x-5" />
    </BaseSwitch.Root>
  );
}
