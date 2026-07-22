import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

interface FeedbackContextType {
  isOpen: boolean;
  openFeedbackModal: () => void;
  closeFeedbackModal: () => void;
}

const FeedbackContext = createContext<FeedbackContextType>({} as FeedbackContextType);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openFeedbackModal = useCallback(() => setIsOpen(true), []);
  const closeFeedbackModal = useCallback(() => setIsOpen(false), []);

  return (
    <FeedbackContext.Provider value={{ isOpen, openFeedbackModal, closeFeedbackModal }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);
