import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toIsoDate } from "../../lib/diary";

export interface WaterDay {
  date: string;
  goal_ml: number;
  total_ml: number;
  entries: { id: number; ml: number; created_at: string }[];
}

export function useWater(date: string = toIsoDate(new Date())) {
  const [dia, setDia] = useState<WaterDay | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .get<WaterDay>("/water", { params: { date } })
      .then((r) => vivo && setDia(r.data))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [date]);

  /** Registra e devolve o id da entrada criada (para o "Desfazer"). */
  const adicionar = useCallback(
    async (ml: number): Promise<number | null> => {
      const r = await api.post<WaterDay>("/water", { date, ml });
      setDia(r.data);
      return r.data.entries.length ? Math.max(...r.data.entries.map((e) => e.id)) : null;
    },
    [date],
  );

  const desfazer = useCallback(async (id: number) => {
    const r = await api.delete<WaterDay>(`/water/${id}`);
    setDia(r.data);
  }, []);

  return { dia, erro, adicionar, desfazer };
}
