import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NuviSlice } from "../brand/NuviSlice";
import { formatKcal } from "../../lib/diary";
import { jaComemorou, marcarComemorada, metasBatidas, ROTULO_META, type MetaBatida } from "../../lib/metas";
import { girarGomos } from "../../lib/girarGomos";
import { movimentoReduzido } from "../../lib/useReducedMotion";
import { ROUTES } from "../../routes";
import type { DiaryDay, Profile } from "../../types";

/**
 * Cartão do Agente Nuvi no Hoje. Quando proteína ou calorias atingem a meta pela primeira
 * vez no dia (flag em localStorage por data), a fatia gira, fica feliz por 900 ms e o aviso
 * "Meta de … batida" sobe 6 px e aparece em 220 ms.
 */
export function CartaoAgente({ day, profile, hoje }: { day: DiaryDay; profile: Profile | null; hoje: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [feliz, setFeliz] = useState(false);
  const [aviso, setAviso] = useState<MetaBatida | null>(null);
  const [aparece, setAparece] = useState(false);

  const batidas = day.date === hoje ? metasBatidas(day, profile) : [];
  const chaveBatidas = batidas.join(",");

  useEffect(() => {
    if (day.date !== hoje) return;
    const nova = chaveBatidas.split(",").filter(Boolean).find((m) => !jaComemorou(day.date, m as MetaBatida)) as
      | MetaBatida
      | undefined;
    if (!nova) return;
    marcarComemorada(day.date, nova);
    let t: ReturnType<typeof setTimeout>;
    const a = requestAnimationFrame(() => {
      setAviso(nova);
      setFeliz(true);
      girarGomos(raiz.current?.querySelector("svg") ?? null);
      requestAnimationFrame(() => setAparece(true));
      t = setTimeout(() => setFeliz(false), 900);
    });
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(t);
    };
  }, [chaveBatidas, day.date, hoje]);

  const alvo = day.calories_target;
  const faltam = alvo !== null ? Math.round(alvo - day.totals.calories) : null;
  const fala =
    day.entries_count === 0
      ? "conte o que você comeu"
      : faltam !== null && faltam > 0
        ? `faltam ${formatKcal(faltam)} kcal para a meta`
        : "continue anotando com o Agente";

  return (
    <Link
      to={ROUTES.agente}
      className="mx-0 my-2.5 flex items-center gap-2.5 rounded-3xl bg-card px-3.5 py-3 active:scale-[.99]"
    >
      <div ref={raiz} className="h-[52px] w-[52px] flex-none">
        <NuviSlice size={52} face={feliz ? "happy" : "normal"} title="Agente Nuvi" />
      </div>
      <div className="min-w-0 flex-1">
        <b className="text-[13px]">Agente Nuvi</b>
        <div className="truncate text-[13px] text-mut">{fala}</div>
        {aviso && (
          <span
            role="status"
            style={{
              transform: aparece ? "none" : "translateY(6px)",
              opacity: aparece ? 1 : 0,
              transition: movimentoReduzido() ? "none" : "opacity 220ms var(--ease-out), transform 220ms var(--ease-out)",
            }}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-pos-soft px-2.5 py-1 text-xs font-extrabold text-pos-text"
          >
            ✓ {ROTULO_META[aviso]}
          </span>
        )}
      </div>
    </Link>
  );
}
