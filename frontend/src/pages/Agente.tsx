import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUp, Camera } from "lucide-react";
import { NuviSlice } from "../components/brand/NuviSlice";
import { Button } from "../components/ui/Button";
import { toast } from "../components/ui/toastStore";
import { api } from "../lib/api";
import { parseAgente, reduzirImagem } from "../lib/agentApi";
import { formatKcal, quantidadePadraoPara, toIsoDate } from "../lib/diary";
import { useDelayedFlag } from "../lib/useDelayedFlag";
import { consentRequiredPurpose } from "../lib/consents";
import { openRegistrar, ROUTES, refeicaoPorHorario, type Refeicao } from "../routes";
import {
  DIARY_UNIT_LABELS,
  MEAL_SLOT_LABELS,
  type AgentParsedItem,
  type AgentParseResponse,
  type DiaryEntryCreate,
  type DiaryUnit,
  type FoodOption,
  type MealSlot,
} from "../types";

interface ItemEstado {
  origem: AgentParsedItem;
  food: FoodOption | null;
  quantity: number;
  unit: DiaryUnit;
  incluido: boolean;
  salvo: boolean;
}

type Mensagem =
  | { id: number; tipo: "eu"; texto: string }
  | { id: number; tipo: "bot"; texto: string; link?: { to: string; label: string } }
  | {
      id: number;
      tipo: "cartao";
      date: string;
      slot: MealSlot;
      itens: ItemEstado[];
      ajustando: boolean;
      salvando: boolean;
      pronto: boolean;
    };

const SLOT_POR_REFEICAO: Record<Refeicao, MealSlot> = {
  cafe: "cafe_da_manha",
  almoco: "almoco",
  lanche: "lanche_tarde",
  jantar: "jantar",
};

const SLOT_PARA_REFEICAO: Partial<Record<MealSlot, Refeicao>> = {
  cafe_da_manha: "cafe",
  almoco: "almoco",
  lanche_tarde: "lanche",
  jantar: "jantar",
};

function kcalDoItem(i: ItemEstado): number | null {
  if (!i.food || i.unit !== i.food.base_unit) return null;
  return i.food.kcal_per_base_unit * i.quantity;
}

function itemInicial(origem: AgentParsedItem): ItemEstado {
  return {
    origem,
    food: origem.food,
    quantity: origem.quantity,
    unit: origem.unit,
    incluido: origem.confidence === "alta" && !!origem.food,
    salvo: false,
  };
}

const SAUDACAO: Mensagem = {
  id: 0,
  tipo: "bot",
  texto: "Oi! Me conte o que você comeu, por texto ou foto, e eu anoto para você confirmar.",
};

export function Agente() {
  const navigate = useNavigate();
  const location = useLocation();
  const [msgs, setMsgs] = useState<Mensagem[]>([SAUDACAO]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const mostrarMascote = useDelayedFlag(enviando, 300);
  const proximoId = useRef(1);
  const fimRef = useRef<HTMLDivElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView?.({ block: "end" });
  }, [msgs.length, enviando]);

  const novoId = () => proximoId.current++;

  function atualizarCartao(id: number, fn: (c: Extract<Mensagem, { tipo: "cartao" }>) => Mensagem) {
    setMsgs((ms) => ms.map((m) => (m.id === id && m.tipo === "cartao" ? fn(m) : m)));
  }

  async function enviar(imagem?: string, legenda?: string) {
    const t = texto.trim();
    if ((!t && !imagem) || enviando) return;
    setEnviando(true);
    try {
      const hoje = toIsoDate(new Date());
      const r: AgentParseResponse = await parseAgente({
        ...(t ? { text: t } : {}),
        ...(imagem ? { image_base64: imagem } : {}),
        date: hoje,
      });
      setTexto("");
      const eu: Mensagem = { id: novoId(), tipo: "eu", texto: t || legenda || "Foto da refeição" };
      if (r.items.length === 0) {
        setMsgs((ms) => [
          ...ms,
          eu,
          { id: novoId(), tipo: "bot", texto: "Não entendi. Tente dizer o alimento e a quantidade, como “2 ovos e pão francês”." },
        ]);
      } else {
        const slot = r.meal_slot ?? SLOT_POR_REFEICAO[refeicaoPorHorario()];
        setMsgs((ms) => [
          ...ms,
          eu,
          {
            id: novoId(),
            tipo: "cartao",
            date: r.date,
            slot,
            itens: r.items.map(itemInicial),
            ajustando: false,
            salvando: false,
            pronto: false,
          },
        ]);
      }
    } catch (e) {
      const resp = (e as { response?: { status?: number; data?: { detail?: unknown } } }).response;
      const detail = resp?.data?.detail as { message?: string } | string | undefined;
      if (resp?.status === 429) {
        const msg = typeof detail === "object" && detail?.message ? detail.message : "Você chegou ao limite do seu plano.";
        setMsgs((ms) => [
          ...ms,
          { id: novoId(), tipo: "bot", texto: msg, link: { to: ROUTES.assinatura, label: "Ver planos" } },
        ]);
      } else if (consentRequiredPurpose(e)) {
        // O ConsentGate pergunta e repete a chamada sozinho; se chegou aqui, o usuário recusou.
        toast("Permita o uso em Perfil > Privacidade");
      } else if (resp?.status === 413) {
        toast("A foto é grande demais. Envie uma de até 4 MB.");
      } else {
        toast("Não deu para ler agora. Tente de novo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function aoEscolherFoto(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await reduzirImagem(file);
      await enviar(dataUrl, "Foto da refeição");
    } catch {
      toast("Não deu para abrir essa foto.");
    }
    if (fotoRef.current) fotoRef.current.value = "";
  }

  async function confirmar(c: Extract<Mensagem, { tipo: "cartao" }>) {
    const a_gravar = c.itens.filter((i) => i.incluido && i.food && !i.salvo);
    if (a_gravar.length === 0) return;
    atualizarCartao(c.id, (x) => ({ ...x, salvando: true }));
    const salvos = new Set<ItemEstado>();
    try {
      for (const i of a_gravar) {
        const body: DiaryEntryCreate = {
          entry_date: c.date,
          meal_slot: c.slot,
          food_ref: i.food!.food_ref,
          quantity: i.quantity,
          unit: i.unit,
        };
        await api.post("/diary", body);
        salvos.add(i);
      }
      atualizarCartao(c.id, (x) => ({
        ...x,
        salvando: false,
        pronto: true,
        ajustando: false,
        itens: x.itens.map((i) => (salvos.has(i) ? { ...i, salvo: true } : i)),
      }));
    } catch {
      toast("Não deu para registrar tudo. Confira o diário e tente de novo.");
      atualizarCartao(c.id, (x) => ({
        ...x,
        salvando: false,
        itens: x.itens.map((i) => (salvos.has(i) ? { ...i, salvo: true, incluido: false } : i)),
      }));
    }
  }

  function mudarItem(cid: number, idx: number, fn: (i: ItemEstado) => ItemEstado) {
    atualizarCartao(cid, (x) => ({ ...x, itens: x.itens.map((i, k) => (k === idx ? fn(i) : i)) }));
  }

  function escolher(cid: number, idx: number, f: FoodOption) {
    mudarItem(cid, idx, (i) => {
      const unit = f.allowed_units.includes(i.unit) ? i.unit : f.allowed_units[0];
      const quantity = unit === i.unit ? i.quantity : quantidadePadraoPara(unit);
      return { ...i, food: f, unit, quantity, incluido: true };
    });
  }

  // TODO(registro): quando a busca do Registrar aceitar um termo na URL, levar `i.origem.name` junto.
  function buscar(c: Extract<Mensagem, { tipo: "cartao" }>) {
    openRegistrar(navigate, location, { refeicao: SLOT_PARA_REFEICAO[c.slot], data: c.date });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-2xl flex-col">
      <div className="flex items-center gap-3 py-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft">
          <NuviSlice size={30} face="normal" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-ink">Agente Nuvi</h2>
          <p className="text-xs font-bold text-pos-text">● pronto para anotar</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 pb-4" aria-live="polite">
        {msgs.map((m) => {
          if (m.tipo === "eu")
            return (
              <div key={m.id} className="ml-auto max-w-[82%] rounded-[20px] rounded-br-md bg-act px-3.5 py-2.5 text-sm font-semibold text-nuvi-tinta">
                {m.texto}
              </div>
            );
          if (m.tipo === "bot")
            return (
              <div key={m.id} className="max-w-[82%] rounded-[20px] rounded-bl-md bg-card px-3.5 py-2.5 text-sm text-ink">
                <p>{m.texto}</p>
                {m.link && (
                  <Link to={m.link.to} className="mt-2 inline-block font-extrabold text-act-text underline">
                    {m.link.label}
                  </Link>
                )}
              </div>
            );
          const incluidos = m.itens.filter((i) => i.incluido && i.food);
          const kcais = incluidos.map(kcalDoItem);
          const total = kcais.length > 0 && kcais.every((k) => k !== null) ? kcais.reduce<number>((a, k) => a + (k ?? 0), 0) : null;
          return (
            <div key={m.id} className="max-w-[92%] rounded-[20px] rounded-bl-md bg-card px-3.5 py-3 text-sm text-ink">
              <b>Anotei no {MEAL_SLOT_LABELS[m.slot].toLowerCase()}:</b>
              {m.itens.map((i, idx) => {
                const kcal = kcalDoItem(i);
                const opcoes = [i.origem.food, ...i.origem.alternatives].filter((f): f is FoodOption => !!f);
                return (
                  <div key={idx} className="mt-2 border-b border-line pb-2 last:border-0">
                    <div className="flex justify-between gap-3">
                      <span className={i.incluido ? "" : "text-mut"}>
                        {i.food?.name ?? i.origem.name} · {String(i.quantity).replace(".", ",")} {i.unit === "un" && i.quantity !== 1 ? "unidades" : DIARY_UNIT_LABELS[i.unit]}
                        {i.food?.is_estimate && <span className="ml-1 text-xs text-mut">(estimado)</span>}
                      </span>
                      <span className="shrink-0 font-bold">{kcal !== null ? formatKcal(kcal) : ""}</span>
                    </div>
                    {i.salvo && <p className="mt-1 text-xs font-bold text-pos-text">✓ registrado</p>}
                    {!i.salvo && !m.pronto && i.origem.confidence === "baixa" && !i.incluido && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-mut">Não tenho certeza.</span>
                        {opcoes.map((f) => (
                          <button
                            key={f.food_ref}
                            type="button"
                            onClick={() => escolher(m.id, idx, f)}
                            className="rounded-full border border-line px-2.5 py-1 text-xs font-bold active:scale-[.97]"
                          >
                            {f.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => buscar(m)}
                          className="rounded-full bg-soft px-2.5 py-1 text-xs font-extrabold active:scale-[.97]"
                        >
                          Buscar
                        </button>
                      </div>
                    )}
                    {m.ajustando && !m.pronto && i.food && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          aria-label={`Quantidade de ${i.food.name}`}
                          value={i.quantity}
                          onChange={(e) => {
                            const q = Number(e.target.value);
                            if (q > 0) mudarItem(m.id, idx, (x) => ({ ...x, quantity: q }));
                          }}
                          className="w-20 rounded-xl border border-line bg-bg px-2 py-1.5 text-sm"
                        />
                        <select
                          aria-label={`Unidade de ${i.food.name}`}
                          value={i.unit}
                          onChange={(e) => mudarItem(m.id, idx, (x) => ({ ...x, unit: e.target.value as DiaryUnit }))}
                          className="rounded-xl border border-line bg-bg px-2 py-1.5 text-sm"
                        >
                          {i.food.allowed_units.map((u) => (
                            <option key={u} value={u}>
                              {DIARY_UNIT_LABELS[u]}
                            </option>
                          ))}
                        </select>
                        {opcoes.length > 1 &&
                          opcoes.map((f) => (
                            <button
                              key={f.food_ref}
                              type="button"
                              aria-pressed={i.food?.food_ref === f.food_ref}
                              onClick={() => escolher(m.id, idx, f)}
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                                i.food?.food_ref === f.food_ref ? "border-act bg-act-soft" : "border-line"
                              }`}
                            >
                              {f.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {total !== null && (
                <div className="mt-2 flex justify-between border-t border-line pt-2">
                  <b>Total</b>
                  <b className="text-act-text">{formatKcal(total)} kcal</b>
                </div>
              )}
              {m.pronto ? (
                <p className="mt-2 text-[13px] font-extrabold text-pos-text">✓ Registrado</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1 py-2.5" disabled={incluidos.length === 0 || m.salvando} onClick={() => void confirmar(m)}>
                    Confirmar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 py-2.5"
                    aria-pressed={m.ajustando}
                    onClick={() => atualizarCartao(m.id, (x) => ({ ...x, ajustando: !x.ajustando }))}
                  >
                    Ajustar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {mostrarMascote && (
          <div className="flex w-fit items-center gap-2 rounded-[20px] rounded-bl-md bg-card px-3.5 py-2.5 text-sm text-mut" role="status">
            <NuviSlice size={26} face="normal" wave />
            Lendo o que você comeu…
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
        className="sticky bottom-[calc(var(--tabbar-space)+8px)] z-10 flex items-center gap-1.5 rounded-[22px] bg-card py-1.5 pl-2 pr-1.5 shadow-lg md:bottom-4"
      >
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Foto da refeição"
          onChange={(e) => void aoEscolherFoto(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fotoRef.current?.click()}
          aria-label="Enviar foto"
          className="flex h-10 w-10 items-center justify-center rounded-full text-mut active:scale-[.97]"
        >
          <Camera className="h-5 w-5" aria-hidden="true" />
        </button>
        <input
          aria-label="Mensagem para o Agente"
          value={texto}
          maxLength={500}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="comi 2 ovos e pão francês…"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold text-ink placeholder:text-mut focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar"
          disabled={enviando || !texto.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-act text-nuvi-tinta active:scale-[.97] disabled:opacity-50"
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
