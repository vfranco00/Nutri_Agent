import type { ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "../../lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

/** Diálogo centrado (confirmações). Aparece em opacidade, 220 ms. */
export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/45 transition-opacity duration-[220ms] ease-out data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 text-ink outline-none",
            "transition-opacity duration-[220ms] ease-out data-starting-style:opacity-0 data-ending-style:opacity-0",
            className,
          )}
        >
          <BaseDialog.Title className="text-lg font-extrabold">{title}</BaseDialog.Title>
          {description ? <BaseDialog.Description className="mt-1 text-sm text-mut">{description}</BaseDialog.Description> : null}
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
