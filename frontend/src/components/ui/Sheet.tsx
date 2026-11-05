import type { ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Folha que sobe de baixo (320 ms, curva de gaveta) e fecha arrastando para baixo,
 * com Esc ou tocando no fundo. O foco volta a quem abriu.
 */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/45 opacity-[calc(1*(1-var(--drawer-swipe-progress,0)))] transition-opacity duration-[320ms] ease-drawer data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup
            className={cn(
              "flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-card text-ink outline-none md:max-w-lg",
              "[transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-[320ms] ease-drawer",
              "data-swiping:select-none data-swiping:duration-0",
              "data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]",
              className,
            )}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <Drawer.Title className="text-lg font-extrabold">{title}</Drawer.Title>
                <Drawer.Close
                  aria-label="Fechar"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-soft text-ink active:scale-[.97]"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Drawer.Close>
              </div>
              {description ? <Drawer.Description className="px-5 pb-2 text-sm text-mut">{description}</Drawer.Description> : null}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">{children}</div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
