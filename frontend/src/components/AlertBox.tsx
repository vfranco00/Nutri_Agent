import { useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  HelpCircle,
} from "lucide-react";

export type AlertType = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: number;
  message: string;
  type: AlertType;
  duration: number;
}

export interface ConfirmData {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const TOAST_STYLES: Record<
  AlertType,
  { icon: typeof CheckCircle2; classes: string; bar: string }
> = {
  success: {
    icon: CheckCircle2,
    classes:
      "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300",
    bar: "bg-green-500",
  },
  error: {
    icon: XCircle,
    classes:
      "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300",
    bar: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-300",
    bar: "bg-orange-500",
  },
  info: {
    icon: Info,
    classes:
      "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300",
    bar: "bg-blue-500",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: number) => void;
}) {
  const { icon: Icon, classes, bar } = TOAST_STYLES[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`relative overflow-hidden w-full max-w-sm rounded-xl border shadow-lg animate-slideInRight bg-white dark:bg-zinc-900 ${classes}`}
    >
      <div className="p-4 flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <p className="text-sm font-medium leading-relaxed flex-1">
          {toast.message}
        </p>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className={`h-1 ${bar} animate-shrinkWidth`}
        style={{ animationDuration: `${toast.duration}ms` }}
      />
    </div>
  );
}

export function AlertBox({
  toasts,
  onDismiss,
  confirmData,
  onConfirmResult,
}: {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
  confirmData: ConfirmData | null;
  onConfirmResult: (result: boolean) => void;
}) {
  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 items-end">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>

      {/* Modal de confirmação (substitui window.confirm) */}
      {confirmData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-start gap-3 mb-6">
              {confirmData.danger ? (
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-500/10 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-500/10 shrink-0">
                  <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <p className="text-zinc-700 dark:text-zinc-200 leading-relaxed pt-1">
                {confirmData.message}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => onConfirmResult(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {confirmData.cancelLabel || "Cancelar"}
              </button>
              <button
                onClick={() => onConfirmResult(true)}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors ${
                  confirmData.danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {confirmData.confirmLabel || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
