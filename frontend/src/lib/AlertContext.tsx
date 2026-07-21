import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertBox,
  type AlertType,
  type ToastData,
  type ConfirmData,
} from "../components/AlertBox";

interface AlertContextType {
  showAlert: (message: string, type?: AlertType, duration?: number) => void;
  confirmDialog: (
    message: string,
    options?: Omit<ConfirmData, "message">,
  ) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType>({} as AlertContextType);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null);
  const idRef = useRef(0);
  const resolveRef = useRef<((result: boolean) => void) | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showAlert = useCallback(
    (message: string, type: AlertType = "info", duration = 4000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    [],
  );

  const confirmDialog = useCallback(
    (message: string, options?: Omit<ConfirmData, "message">) => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setConfirmData({ message, ...options });
      });
    },
    [],
  );

  function handleConfirmResult(result: boolean) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setConfirmData(null);
  }

  return (
    <AlertContext.Provider value={{ showAlert, confirmDialog }}>
      {children}
      <AlertBox
        toasts={toasts}
        onDismiss={dismissToast}
        confirmData={confirmData}
        onConfirmResult={handleConfirmResult}
      />
    </AlertContext.Provider>
  );
}

export const useAlert = () => useContext(AlertContext);
