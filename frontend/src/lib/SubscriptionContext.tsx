import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

export interface UsageInfo {
  event_type: string;
  used: number;
  limit: number | null;
  window_days: number;
}

export interface Subscription {
  plan: "starter" | "plus" | "pro";
  status: string;
  current_period_end: string | null;
  usage: UsageInfo[];
  shopping_list_access: boolean;
  max_saved_meal_plans: number | null;
  saved_meal_plans_used: number;
  max_saved_recipes: number | null;
  saved_recipes_used: number;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  getUsage: (eventType: string) => UsageInfo | undefined;
}

const SubscriptionContext = createContext<SubscriptionContextType>({} as SubscriptionContextType);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/subscriptions/me");
      setSubscription(res.data);
    } catch (error) {
      console.error("Erro ao buscar assinatura:", error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  function getUsage(eventType: string) {
    return subscription?.usage.find((u) => u.event_type === eventType);
  }

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription, getUsage }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
