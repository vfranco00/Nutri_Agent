import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { fetchConsents, saveConsent, type Purpose } from "../../lib/consents";
import { Switch } from "../../components/ui/Switch";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/toastStore";
import { ROUTES } from "../../routes";

const FINALIDADES: { purpose: Exclude<Purpose, "saude">; titulo: string; texto: string }[] = [
  { purpose: "ia", titulo: "Enviar dados à IA", texto: "Texto, fotos e partes do perfil vão para o Google Gemini, nos EUA, para cardápios, receitas e leitura de refeições." },
  { purpose: "push", titulo: "Lembretes no aparelho", texto: "Guardamos o endereço de notificação do aparelho para avisar da água e das refeições." },
  { purpose: "ranking", titulo: "Aparecer na comunidade", texto: "Seu nome e sua posição aparecem no ranking. Por padrão você fica oculto." },
  { purpose: "marketing", titulo: "Novidades por e-mail", texto: "Receber dicas e novidades do Nuvi." },
];

function mensagemErro(err: unknown, padrao: string): string {
  const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof d === "string" ? d : padrao;
}

export function Privacidade() {
  const { logout } = useAuth();
  const [concedidos, setConcedidos] = useState<Record<string, boolean> | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [senha, setSenha] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  function aplicar(items: { purpose: string; granted: boolean }[]) {
    setConcedidos(Object.fromEntries(items.map((i) => [i.purpose, i.granted])));
  }

  useEffect(() => {
    fetchConsents().then((s) => aplicar(s.items)).catch(() => toast("Não foi possível carregar suas permissões."));
  }, []);

  async function alternar(purpose: Purpose, granted: boolean) {
    setSalvando(purpose);
    try {
      const s = await saveConsent(purpose, granted, "perfil");
      aplicar(s.items);
    } catch {
      toast("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  }

  async function baixar() {
    setBaixando(true);
    try {
      const res = await api.get("/privacy/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nuvi-meus-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(mensagemErro(err, "Não foi possível gerar seus dados agora."));
    } finally {
      setBaixando(false);
    }
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    setErro("");
    try {
      await api.delete("/privacy/account", { data: { password: senha } });
      logout();
      window.location.assign("/");
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível excluir a conta. Nada foi apagado."));
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6 text-ink">
      <div>
        <Link to={ROUTES.perfil} className="text-sm font-semibold text-act-text">← Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold">Privacidade</h1>
        <p className="mt-1 text-sm text-mut">Você decide o que o Nuvi pode fazer com seus dados. Ligar e desligar custa um toque.</p>
      </div>

      <section aria-label="Permissões" className="divide-y divide-line rounded-3xl bg-card">
        <div className="p-4">
          <p className="font-bold">Dados de saúde</p>
          <p className="mt-1 text-sm text-mut">
            Peso, medidas e diário são necessários para o Nuvi funcionar. Para retirar esta permissão, é preciso excluir a conta (veja abaixo).
          </p>
        </div>
        {FINALIDADES.map((f) => (
          <div key={f.purpose} className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p id={`finalidade-${f.purpose}`} className="font-bold">{f.titulo}</p>
              <p className="mt-1 text-sm text-mut">{f.texto}</p>
            </div>
            <Switch
              aria-labelledby={`finalidade-${f.purpose}`}
              checked={!!concedidos?.[f.purpose]}
              disabled={concedidos === null || salvando === f.purpose}
              onCheckedChange={(v) => alternar(f.purpose, v)}
            />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <Button variant="outline" className="w-full" onClick={baixar} disabled={baixando}>
          <Download className="h-4 w-4" aria-hidden="true" /> Baixar meus dados
        </Button>
        <Button variant="outline" className="w-full text-red-700" onClick={() => { setSenha(""); setErro(""); setExcluir(true); }}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir minha conta
        </Button>
      </section>

      <p className="text-xs text-mut">
        <Link to="/privacidade" className="underline">Política de Privacidade</Link> · <Link to="/termos" className="underline">Termos de Uso</Link>
      </p>

      <Dialog
        open={excluir}
        onOpenChange={(o) => { if (!excluindo) setExcluir(o); }}
        title="Excluir minha conta"
        description="Esta ação não pode ser desfeita."
      >
        <p className="mt-3 text-sm">
          Apagamos seu perfil, diário, peso, água, receitas, cardápios, listas e permissões. Os registros de pagamento ficam sem ligação com você
          (anonimizados), porque a lei exige guardá-los. A assinatura recorrente é cancelada antes.
        </p>
        <label htmlFor="senha-exclusao" className="mt-4 block text-sm font-bold">Sua senha</label>
        <Input id="senha-exclusao" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1" />
        {erro && <p role="alert" className="mt-2 text-sm text-red-600">{erro}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <Button className="bg-red-600 text-white" onClick={confirmarExclusao} disabled={!senha || excluindo}>Excluir definitivamente</Button>
          <Button variant="ghost" onClick={() => setExcluir(false)} disabled={excluindo}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  );
}
