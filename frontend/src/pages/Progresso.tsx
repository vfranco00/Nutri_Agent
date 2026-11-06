import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { formatKcal, shiftIsoDate, toIsoDate } from "../lib/diary";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Sheet } from "../components/ui/Sheet";
import { Skeleton } from "../components/ui/Skeleton";
import { toast } from "../components/ui/toastStore";
import { pontosDoGrafico } from "../lib/progresso";
import { ROUTES } from "../routes";
import type { DiarySummaryResponse } from "../types";

interface Pesagem {
  date: string;
  weight: number;
}

const kg = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * Progresso (protótipo `pgProgress()`): só o peso. Lê `GET /profiles/weight/history`, registra
 * com `POST /profiles/weight` e mostra a média da semana pelo `GET /diary/summary` (a semana
 * em que o usuário registrou: kcal/dia e dias registrados).
 */
export function Progresso() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [historico, setHistorico] = useState<Pesagem[] | null>(null);
  const [semana, setSemana] = useState<DiarySummaryResponse | null>(null);
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await api.get("/profiles/weight/history");
      setHistorico(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      setHistorico([]);
    }
    try {
      const fim = toIsoDate(new Date());
      const res = await api.get<DiarySummaryResponse>("/diary/summary", {
        params: { start: shiftIsoDate(fim, -6), end: fim },
      });
      setSemana(res.data);
    } catch {
      setSemana(null);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    const peso = Number(valor.replace(",", "."));
    if (!Number.isFinite(peso) || peso <= 0 || peso > 500) {
      showAlert("Informe um peso válido em kg.", "warning");
      return;
    }
    setSalvando(true);
    try {
      const res = await api.post("/profiles/weight", { weight: peso });
      setHistorico((h) => [...(h ?? []), res.data]);
      setAberto(false);
      setValor("");
      toast("Peso registrado");
    } catch (error) {
      console.error(error);
      showAlert("Não foi possível registrar o peso.", "error");
    } finally {
      setSalvando(false);
    }
  }

  const pesos = (historico ?? []).map((h) => h.weight);
  const atual = pesos.length ? pesos[pesos.length - 1] : null;
  const delta = pesos.length > 1 ? pesos[pesos.length - 1] - pesos[0] : null;
  const pts = pontosDoGrafico(pesos);

  const diasComRegistro = semana?.days.filter((d) => d.entries_count > 0) ?? [];
  const mediaKcal = diasComRegistro.length
    ? diasComRegistro.reduce((a, d) => a + d.calories, 0) / diasComRegistro.length
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.hoje)}
          aria-label="Voltar"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-card active:scale-[.97]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em]">
          Seu <span className="text-act-text">progresso</span>
        </h1>
      </div>

      {historico === null ? (
        <div aria-hidden="true" className="space-y-2 pt-3">
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ) : (
        <>
          <section aria-label="Peso" className="mt-3 rounded-3xl bg-card px-4 py-3.5">
            {atual === null ? (
              <p className="py-4 text-center text-sm text-mut">Nenhuma pesagem ainda. Registre a primeira abaixo.</p>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs font-bold text-mut">peso hoje</div>
                    <b className="text-[32px] tracking-[-0.03em]">{kg(atual)}</b> <span className="text-mut">kg</span>
                  </div>
                  {delta !== null && (
                    <b className={`text-[13px] ${delta <= 0 ? "text-pos-text" : "text-mut"}`}>
                      {delta > 0 ? "+" : "−"}
                      {kg(Math.abs(delta))} kg desde a primeira pesagem
                    </b>
                  )}
                </div>
                {pts.length > 1 && (
                  <svg
                    viewBox="0 0 300 130"
                    role="img"
                    aria-label={`Peso de ${kg(pesos[0])} para ${kg(atual)} quilos em ${pesos.length} pesagens.`}
                    className="mt-2 h-[130px] w-full overflow-visible"
                  >
                    <polyline
                      points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="var(--act)"
                      strokeWidth="3.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {pts.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill="var(--act)" />
                    ))}
                  </svg>
                )}
              </>
            )}
          </section>

          <section aria-label="Média da semana" className="mt-2.5 rounded-3xl bg-card px-4 py-3.5">
            <b>Média da semana</b>
            <div className="mt-1.5 flex gap-2">
              <div className="flex-1 rounded-2xl bg-soft px-2 py-2.5 text-center text-[11.5px] text-mut">
                <b className="block text-[14.5px] text-ink">{mediaKcal === null ? "—" : formatKcal(mediaKcal)}</b>
                kcal/dia
              </div>
              <div className="flex-1 rounded-2xl bg-soft px-2 py-2.5 text-center text-[11.5px] text-mut">
                <b className="block text-[14.5px] text-ink">
                  {semana ? `${diasComRegistro.length}/${semana.days.length}` : "—"}
                </b>
                dias registrados
              </div>
            </div>
          </section>

          <section className="mt-2.5 rounded-3xl border-2 border-dashed border-line px-4 py-3.5">
            <b>Em breve</b>
            <p className="text-[12.5px] font-semibold text-mut">
              a meta se ajusta sozinha pelo seu peso real, num check-in semanal
            </p>
          </section>
        </>
      )}

      <div className="pt-3">
        <Button onClick={() => setAberto(true)} className="w-full py-3.5">
          <Scale className="h-5 w-5" aria-hidden="true" />
          Registrar peso
        </Button>
      </div>

      <Sheet open={aberto} onOpenChange={setAberto} title="Registrar peso">
        <form onSubmit={registrar} className="space-y-4">
          <div>
            <label htmlFor="peso-hoje" className="mb-1.5 block text-xs font-bold text-mut">
              Peso de hoje (kg)
            </label>
            <Input
              id="peso-hoje"
              type="text"
              inputMode="decimal"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={atual !== null ? kg(atual) : "70,5"}
            />
          </div>
          <Button type="submit" disabled={salvando} className="w-full py-3">
            Salvar peso
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
