import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Check, ChevronsUpDown, Plus, ScanBarcode, Search, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/Tabs";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/toastStore";
import { RepetirOntem } from "../../components/diary/RepetirOntem";
import { EstimateBadge } from "../../components/diary/EstimateBadge";
import { useFoodSearch, SEARCH_MAX_LENGTH } from "../../lib/useFoodSearch";
import { useDelayedFlag } from "../../lib/useDelayedFlag";
import { formatKcal, relativeDayLabel, toIsoDate } from "../../lib/diary";
import {
  apagarEntrada, ehRefeicao, idsNovosDoLote, listarFrequentes, listarMeus, listarReceitas, listarRecentes,
  mensagemDeErro, NOME_DA_REFEICAO, opcaoDoMeu, padraoDoMais, previa, REFEICOES,
  SLOT_DA_REFEICAO, salvarLote,
} from "../../lib/registro";
import { ROUTES, refeicaoPorHorario, type Refeicao } from "../../routes";
import type { DiaryUnit, FoodOption } from "../../types";
import { PorcaoSheet } from "./PorcaoSheet";

type Aba = "buscar" | "recentes" | "frequentes" | "meus" | "receitas";
const ABAS: Array<[Aba, string]> = [
  ["buscar", "Buscar"], ["recentes", "Recentes"], ["frequentes", "Frequentes"], ["meus", "Meus"], ["receitas", "Receitas"],
];

interface ItemCarrinho {
  food: FoodOption;
  quantity: number;
  unit: DiaryUnit;
}

/** Conteúdo da folha Registrar (protótipo `openReg` / `renderReg` / `saveCart`). */
export function Registrar({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const refParam = params.get("refeicao");
  const refeicao: Refeicao = ehRefeicao(refParam) ? refParam : refeicaoPorHorario();
  const data = params.get("data") ?? toIsoDate(new Date());
  const slot = SLOT_DA_REFEICAO[refeicao];
  const background = (location.state as { background?: unknown } | null)?.background ?? location;

  const busca = useFoodSearch();
  const [aba, setAba] = useState<Aba>("buscar");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [porcao, setPorcao] = useState<FoodOption | null>(null);
  const [salvando, setSalvando] = useState(false);

  function proximaRefeicao() {
    const prox = REFEICOES[(REFEICOES.indexOf(refeicao) + 1) % REFEICOES.length];
    setParams((a) => {
      const n = new URLSearchParams(a);
      n.set("refeicao", prox);
      return n;
    }, { replace: true, state: location.state });
  }

  function adicionar(food: FoodOption, quantity: number, unit: DiaryUnit) {
    setCarrinho((c) => [...c, { food, quantity, unit }]);
    toast(`${food.name} adicionado`);
  }

  const emCarrinho = (ref: string) => carrinho.some((i) => i.food.food_ref === ref);

  // Prévia do carrinho: soma as prévias por item (o servidor devolve os números reais ao salvar).
  const kcalCarrinho = useMemo(() => carrinho.reduce((a, i) => a + previa(i.food, i.quantity, i.unit).kcal, 0), [carrinho]);

  async function salvar() {
    if (carrinho.length === 0 || salvando) return;
    setSalvando(true);
    try {
      const n = carrinho.length;
      const dia = await salvarLote({
        entry_date: data,
        meal_slot: slot,
        items: carrinho.map((i) => ({ food_ref: i.food.food_ref, quantity: i.quantity, unit: i.unit })),
      });
      const ids = idsNovosDoLote(dia, slot, n);
      onClose();
      toast(`${n} ${n > 1 ? "itens salvos" : "item salvo"} no ${NOME_DA_REFEICAO[refeicao].toLowerCase()}`, {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              for (const id of ids) await apagarEntrada(id);
            } catch (err) {
              toast(mensagemDeErro(err, "Não foi possível desfazer."));
            }
          },
        },
      });
    } catch (err) {
      toast(mensagemDeErro(err, "Não foi possível salvar agora."));
    } finally {
      setSalvando(false);
    }
  }

  const buscando = busca.term.trim().length > 0;
  useEffect(() => {
    if (buscando) setAba("buscar");
  }, [buscando]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-5 pb-3">
        <button
          type="button"
          onClick={proximaRefeicao}
          aria-label={`Refeição: ${NOME_DA_REFEICAO[refeicao]}. Tocar para trocar`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-soft px-3 py-1.5 text-sm font-extrabold text-ink"
        >
          {NOME_DA_REFEICAO[refeicao]} · {relativeDayLabel(data)}
          <ChevronsUpDown className="h-4 w-4 text-mut" aria-hidden="true" />
        </button>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" aria-hidden="true" />
            <Input
              aria-label="Buscar alimento"
              placeholder="Buscar alimento"
              value={busca.term}
              maxLength={SEARCH_MAX_LENGTH}
              onChange={(e) => busca.setTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Link
            to={ROUTES.codigoDeBarras}
            state={{ background }}
            aria-label="Ler código de barras"
            className="flex w-12 items-center justify-center rounded-2xl bg-soft text-ink active:scale-[.97]"
          >
            <ScanBarcode className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-3 empty:hidden">
          {!buscando ? <RepetirOntem refeicao={refeicao} data={data} onDone={onClose} /> : null}
        </div>
        <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
          <TabsList className="mb-3 gap-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ABAS.map(([k, n]) => (
              <TabsTab key={k} value={k} className="px-2.5 text-[13px]">{n}</TabsTab>
            ))}
          </TabsList>

          <TabsPanel value="buscar">
            <Resultados busca={busca} emCarrinho={emCarrinho} onAbrir={setPorcao} onMais={(f) => adicionar(f, padraoDoMais(f).quantity, padraoDoMais(f).unit)} onFechar={onClose} />
          </TabsPanel>
          {(["recentes", "frequentes", "meus", "receitas"] as const).map((k) => (
            <TabsPanel key={k} value={k}>
              <ListaDaAba aba={k} emCarrinho={emCarrinho} onAbrir={setPorcao} onMais={adicionar} />
            </TabsPanel>
          ))}
        </Tabs>
      </div>

      {carrinho.length > 0 ? (
        <div className="flex items-center gap-3 border-t border-line bg-card px-5 py-3">
          <button type="button" onClick={() => setCarrinho([])} aria-label="Esvaziar carrinho" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="flex-1 text-sm font-bold" aria-live="polite">
            {carrinho.length} {carrinho.length > 1 ? "itens" : "item"} · {formatKcal(kcalCarrinho)} kcal
          </span>
          <Button onClick={salvar} disabled={salvando}>Salvar</Button>
        </div>
      ) : null}

      <PorcaoSheet
        food={porcao}
        destino={`${NOME_DA_REFEICAO[refeicao]} · ${relativeDayLabel(data)}`}
        onClose={() => setPorcao(null)}
        onAdd={(f, q, u) => {
          adicionar(f, q, u);
          setPorcao(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Linha({ food, detalhe, noCarrinho, onAbrir, onMais }: { food: FoodOption; detalhe: string; noCarrinho: boolean; onAbrir: () => void; onMais: () => void }) {
  return (
    <li className="flex items-center gap-2 py-2">
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <b className="flex items-center gap-1.5 text-sm"><span className="truncate">{food.name}</span><EstimateBadge isEstimate={food.is_estimate} compact /></b>
        <span className="block truncate text-xs text-mut">{detalhe}</span>
      </button>
      <button
        type="button"
        onClick={onMais}
        aria-label={`Adicionar ${food.name}`}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:scale-[.97] ${noCarrinho ? "bg-pos text-nuvi-tinta" : "bg-act text-nuvi-tinta"}`}
      >
        {noCarrinho ? <Check className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
      </button>
    </li>
  );
}

function detalheDe(f: FoodOption): string {
  const por = f.portion_label ?? (f.base_unit === "un" ? "unidade" : "100 g");
  return f.base_unit === "un" || f.portion_label
    ? `${por} · ${formatKcal(f.kcal_per_base_unit)} kcal`
    : `${por} · ${formatKcal(f.kcal_per_base_unit * 100)} kcal`;
}

interface PropsLista {
  emCarrinho: (ref: string) => boolean;
  onAbrir: (f: FoodOption) => void;
}

function Resultados({ busca, emCarrinho, onAbrir, onMais, onFechar }: PropsLista & { busca: ReturnType<typeof useFoodSearch>; onMais: (f: FoodOption) => void; onFechar: () => void }) {
  const lento = useDelayedFlag(busca.status === "searching");
  if (busca.term.trim().length === 0) {
    return <p className="py-6 text-center text-sm text-mut">Digite o nome de um alimento, ou escolha uma aba.</p>;
  }
  if (lento && busca.results.length === 0) return <Carregando />;
  return (
    <div>
      {busca.error ? <p role="alert" className="py-3 text-sm text-red-600">{busca.error}</p> : null}
      <ul className="divide-y divide-line">
        {busca.results.map((f) => (
          <Linha key={f.food_ref} food={f} detalhe={detalheDe(f)} noCarrinho={emCarrinho(f.food_ref)} onAbrir={() => onAbrir(f)} onMais={() => onMais(f)} />
        ))}
      </ul>
      {busca.status === "ready" ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-soft p-3 text-sm">
          <span className="flex-1">Não achou? <Link to={ROUTES.agente} onClick={onFechar} className="font-extrabold text-act-text">Pedir ao Agente</Link></span>
        </div>
      ) : null}
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando">
      <Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" />
    </div>
  );
}

function ListaDaAba({ aba, emCarrinho, onAbrir, onMais }: PropsLista & { aba: Exclude<Aba, "buscar">; onMais: (f: FoodOption, q: number, u: DiaryUnit) => void }) {
  const [itens, setItens] = useState<Array<{ food: FoodOption; quantity: number; unit: DiaryUnit }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lento = useDelayedFlag(itens === null && erro === null);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      if (aba === "recentes") return (await listarRecentes()).map((q) => ({ food: q.food, quantity: q.quantity, unit: q.unit }));
      if (aba === "frequentes") return (await listarFrequentes()).map((q) => ({ food: q.food, quantity: q.quantity, unit: q.unit }));
      if (aba === "meus") return (await listarMeus()).map(opcaoDoMeu).map((food) => ({ food, ...padraoDoMais(food) }));
      return (await listarReceitas()).map((food) => ({ food, ...padraoDoMais(food) }));
    };
    carregar()
      .then((r) => ativo && setItens(r))
      .catch((e) => ativo && setErro(mensagemDeErro(e, "Não foi possível carregar a lista.")));
    return () => {
      ativo = false;
    };
  }, [aba]);

  if (erro) return <p role="alert" className="py-3 text-sm text-red-600">{erro}</p>;
  if (itens === null) return lento ? <Carregando /> : null;
  if (itens.length === 0) {
    const vazio = {
      recentes: "Quando você registrar alimentos, os últimos aparecem aqui.",
      frequentes: "Os alimentos que você mais registra aparecem aqui.",
      meus: "Você ainda não criou alimentos próprios.",
      receitas: "Suas receitas com calorias aparecem aqui.",
    }[aba];
    return (
      <div className="py-6 text-center text-sm text-mut">
        <p>{vazio}</p>
        {aba === "meus" ? <Link to={ROUTES.alimentoNovo} className="mt-2 inline-block font-extrabold text-act-text">Criar alimento</Link> : null}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {itens.map((i) => (
        <Linha key={i.food.food_ref} food={i.food} detalhe={detalheDe(i.food)} noCarrinho={emCarrinho(i.food.food_ref)} onAbrir={() => onAbrir(i.food)} onMais={() => onMais(i.food, i.quantity, i.unit)} />
      ))}
    </ul>
  );
}
