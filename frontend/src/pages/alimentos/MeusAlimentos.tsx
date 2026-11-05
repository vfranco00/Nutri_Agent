import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/Tabs";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/toastStore";
import { useDelayedFlag } from "../../lib/useDelayedFlag";
import { formatKcal, toIsoDate } from "../../lib/diary";
import { apagarRefeicaoPronta, listarMeus, listarRefeicoesProntas, mensagemDeErro, registrarRefeicaoPronta, SLOT_DA_REFEICAO } from "../../lib/registro";
import { ROUTES, refeicaoPorHorario } from "../../routes";
import type { SavedMeal, UserFood } from "../../types";

/** `/alimentos` (protótipo `pgMyFoods`): alimentos pessoais e refeições prontas. */
export function MeusAlimentos() {
  const [aba, setAba] = useState<"alimentos" | "prontas">("alimentos");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">Meus <span className="text-act-text">alimentos</span></h1>
        <Link to={ROUTES.alimentoNovo} aria-label="Criar alimento" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-act text-nuvi-tinta active:scale-[.97]">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList className="mb-3">
          <TabsTab value="alimentos">Alimentos</TabsTab>
          <TabsTab value="prontas">Refeições prontas</TabsTab>
        </TabsList>
        <TabsPanel value="alimentos"><Alimentos /></TabsPanel>
        <TabsPanel value="prontas"><Prontas /></TabsPanel>
      </Tabs>
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando">
      <Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" />
    </div>
  );
}

function Alimentos() {
  const [itens, setItens] = useState<UserFood[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lento = useDelayedFlag(itens === null && erro === null);
  useEffect(() => {
    let ativo = true;
    listarMeus().then((r) => ativo && setItens(r)).catch((e) => ativo && setErro(mensagemDeErro(e, "Não foi possível carregar seus alimentos.")));
    return () => { ativo = false; };
  }, []);
  if (erro) return <p role="alert" className="text-sm text-red-600">{erro}</p>;
  if (itens === null) return lento ? <Carregando /> : null;
  if (itens.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-mut">
        <p>Você ainda não criou alimentos próprios.</p>
        <Link to={ROUTES.alimentoNovo} className="mt-2 inline-block font-extrabold text-act-text">Criar o primeiro</Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-3xl bg-card px-4">
      {itens.map((f) => (
        <li key={f.id}>
          <Link to={`${ROUTES.alimentos}/${f.id}`} className="flex items-center gap-3 py-3.5">
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{f.name}</b>
              <span className="block text-xs text-mut">{f.portion_label} · {formatKcal(f.kcal)} kcal{f.barcode ? " · código de barras" : ""}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-mut" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Prontas() {
  const [itens, setItens] = useState<SavedMeal[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lento = useDelayedFlag(itens === null && erro === null);
  useEffect(() => {
    let ativo = true;
    listarRefeicoesProntas().then((r) => ativo && setItens(r)).catch((e) => ativo && setErro(mensagemDeErro(e, "Não foi possível carregar as refeições prontas.")));
    return () => { ativo = false; };
  }, []);

  async function registrar(m: SavedMeal) {
    try {
      await registrarRefeicaoPronta(m.id, { entry_date: toIsoDate(new Date()), meal_slot: SLOT_DA_REFEICAO[refeicaoPorHorario()] });
      toast(`${m.name} registrado`);
    } catch (e) {
      toast(mensagemDeErro(e, "Não foi possível registrar agora."));
    }
  }
  async function apagar(m: SavedMeal) {
    try {
      await apagarRefeicaoPronta(m.id);
      setItens((l) => (l ?? []).filter((x) => x.id !== m.id));
      toast("Refeição pronta apagada");
    } catch (e) {
      toast(mensagemDeErro(e, "Não foi possível apagar agora."));
    }
  }

  if (erro) return <p role="alert" className="text-sm text-red-600">{erro}</p>;
  if (itens === null) return lento ? <Carregando /> : null;
  if (itens.length === 0) {
    return <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-mut">Salve uma refeição do diário pelo menu da refeição e ela aparece aqui.</p>;
  }
  return (
    <ul className="divide-y divide-line rounded-3xl bg-card px-4">
      {itens.map((m) => (
        <li key={m.id} className="flex items-center gap-2 py-3.5">
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{m.name}</b>
            <span className="block truncate text-xs text-mut">{m.items.map((i) => i.food_name).join(", ")} · {formatKcal(m.calories)} kcal</span>
          </span>
          <button type="button" onClick={() => registrar(m)} className="rounded-xl bg-act px-3 py-2 text-xs font-extrabold text-nuvi-tinta active:scale-[.97]">Registrar</button>
          <button type="button" onClick={() => apagar(m)} aria-label={`Apagar ${m.name}`} className="flex h-9 w-9 items-center justify-center rounded-xl text-mut hover:text-red-600">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
