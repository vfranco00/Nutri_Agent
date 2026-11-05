import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/toastStore";
import { apagarMeu, criarMeu, editarMeu, mensagemDeErro, obterMeu } from "../../lib/registro";
import { ROUTES } from "../../routes";
import type { UserFood, UserFoodCreate } from "../../types";

const num = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * `/alimentos/novo?barcode=` cria; `/alimentos/:id` edita e apaga. Os valores são POR PORÇÃO.
 * Macro em branco vira `null` ("não sei"), nunca zero.
 */
export function AlimentoForm() {
  const { id } = useParams();
  const editando = id !== undefined;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [carregando, setCarregando] = useState(editando);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [f, setF] = useState({ name: "", portion_label: "1 porção", portion_grams: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "", barcode: params.get("barcode") ?? "" });

  useEffect(() => {
    if (!editando) return;
    let ativo = true;
    obterMeu(id)
      .then((a: UserFood) => {
        if (!ativo) return;
        setF({
          name: a.name, portion_label: a.portion_label, portion_grams: a.portion_grams?.toString() ?? "", kcal: String(a.kcal),
          protein_g: a.protein_g?.toString() ?? "", carbs_g: a.carbs_g?.toString() ?? "", fat_g: a.fat_g?.toString() ?? "", barcode: a.barcode ?? "",
        });
        setCarregando(false);
      })
      .catch((e) => {
        if (!ativo) return;
        setErro(mensagemDeErro(e, "Não encontramos esse alimento."));
        setCarregando(false);
      });
    return () => { ativo = false; };
  }, [editando, id]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const kcal = num(f.kcal);
    const campos = { portion_grams: num(f.portion_grams), protein_g: num(f.protein_g), carbs_g: num(f.carbs_g), fat_g: num(f.fat_g) };
    if (!f.name.trim()) return setErro("Dê um nome ao alimento.");
    if (kcal === null || Number.isNaN(kcal)) return setErro("Informe as calorias da porção.");
    if (Object.values(campos).some((v) => v !== null && Number.isNaN(v))) return setErro("Use só números nos campos de quantidade.");
    const body: UserFoodCreate = {
      name: f.name.trim(), portion_label: f.portion_label.trim() || "1 porção", kcal, ...campos,
      barcode: f.barcode.trim() === "" ? null : f.barcode.trim(),
    };
    setEnviando(true);
    setErro(null);
    try {
      if (editando) await editarMeu(id, body);
      else await criarMeu(body);
      toast(editando ? "Alimento atualizado" : "Alimento criado");
      navigate(ROUTES.alimentos, { replace: true });
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar agora."));
    } finally {
      setEnviando(false);
    }
  }

  async function apagar() {
    try {
      await apagarMeu(id!);
      toast("Alimento apagado");
      navigate(ROUTES.alimentos, { replace: true });
    } catch (e) {
      setApagando(false);
      setErro(mensagemDeErro(e, "Não foi possível apagar agora."));
    }
  }

  if (carregando) return null;

  const campo = (rotulo: string, k: keyof typeof f, extra: Record<string, unknown> = {}) => (
    <label className="block text-sm font-bold">
      {rotulo}
      <Input value={f[k]} onChange={set(k)} className="mt-1" {...extra} />
    </label>
  );

  return (
    <form onSubmit={enviar} className="mx-auto max-w-lg space-y-4" noValidate>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(ROUTES.alimentos)} aria-label="Voltar" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-soft">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="flex-1 text-2xl font-black tracking-tight">{editando ? "Editar alimento" : "Novo alimento"}</h1>
        {editando ? (
          <button type="button" onClick={() => setApagando(true)} aria-label="Apagar alimento" className="flex h-10 w-10 items-center justify-center rounded-2xl text-red-600 hover:bg-soft">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {campo("Nome", "name", { maxLength: 120, autoFocus: !editando })}
      <div className="grid grid-cols-2 gap-3">
        {campo("Porção", "portion_label", { maxLength: 60 })}
        {campo("Peso da porção (g)", "portion_grams", { inputMode: "decimal" })}
      </div>
      {campo("Calorias da porção (kcal)", "kcal", { inputMode: "decimal" })}
      <div className="grid grid-cols-3 gap-3">
        {campo("Proteína (g)", "protein_g", { inputMode: "decimal" })}
        {campo("Carbo (g)", "carbs_g", { inputMode: "decimal" })}
        {campo("Gordura (g)", "fat_g", { inputMode: "decimal" })}
      </div>
      <p className="-mt-2 text-xs text-mut">Deixe em branco o que você não sabe: fica como “não informado”, não como zero.</p>
      {campo("Código de barras (opcional)", "barcode", { inputMode: "numeric", maxLength: 14 })}

      {erro ? <p role="alert" className="text-sm font-semibold text-red-600">{erro}</p> : null}
      <Button type="submit" className="w-full" disabled={enviando}>Salvar</Button>

      <Dialog open={apagando} onOpenChange={setApagando} title="Apagar alimento?" description="As refeições já registradas continuam com os mesmos valores.">
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setApagando(false)}>Cancelar</Button>
          <Button onClick={apagar} className="bg-red-600 text-white">Apagar</Button>
        </div>
      </Dialog>
    </form>
  );
}
