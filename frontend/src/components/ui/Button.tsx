import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "ghost" | "outline";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Laranja com texto tinta (#1C1712), nunca branco; sem gradiente.
const VARIANTES: Record<ButtonVariant, string> = {
  primary: "bg-act text-nuvi-tinta",
  ghost: "bg-transparent text-ink hover:bg-soft",
  outline: "border border-line bg-card text-ink hover:bg-soft",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-extrabold",
        "transition-transform duration-[140ms] ease-out active:scale-[.97]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-act-text",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTES[variant],
        className,
      )}
      {...rest}
    />
  );
});
