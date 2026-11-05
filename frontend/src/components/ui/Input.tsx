import type { ComponentProps } from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { cn } from "../../lib/utils";

export function Input({ className, ...rest }: ComponentProps<typeof BaseInput>) {
  return (
    <BaseInput
      className={cn(
        "w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink placeholder:text-mut",
        "focus-visible:outline-2 focus-visible:outline-act-text",
        className,
      )}
      {...rest}
    />
  );
}
