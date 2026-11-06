import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Switch } from "../../components/ui/Switch";
import { toast } from "../../components/ui/toastStore";
import { api } from "../../lib/api";
import { ativarPush, pushAtivoNesteAparelho, pushSuportado } from "../../lib/push";
import { ROUTES } from "../../routes";

interface Lembrete {
  kind: string;
  time: string;
  enabled: boolean;
}
interface Estado {
  timezone: string;
  reminders: Lembrete[];
}

const NOMES: Record<string, string> = {
  cafe: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
  agua: "Beber água",
  peso: "Pesar-se",
};

export function Lembretes() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aviso, setAviso] = useState("");
  const suporte = pushSuportado();
  const ocupado = useRef(false);

  useEffect(() => {
    let vivo = true;
    api
      .get<Estado>("/reminders")
      .then((r) => vivo && setEstado(r.data))
      .catch(() => vivo && toast("Não deu para carregar os lembretes."));
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(novo: Estado, anterior: Estado) {
    setEstado(novo);
    try {
      const r = await api.put<Estado>("/reminders", novo);
      setEstado(r.data);
    } catch {
      setEstado(anterior);
      toast("Não deu para salvar. Tente de novo.");
    }
  }

  async function mudar(kind: string, parte: Partial<Lembrete>) {
    if (!estado || ocupado.current) return;
    ocupado.current = true;
    try {
      const ligando = parte.enabled === true;
      if (ligando && !(await pushAtivoNesteAparelho())) {
        const r = await ativarPush();
        if (r === "negado") {
          setAviso("O navegador bloqueou as notificações. Libere nas configurações do site e tente de novo.");
          return;
        }
        if (r === "sem_consentimento") {
          setAviso("Para receber lembretes, permita as notificações do aparelho. Você pode mudar isso em Perfil > Privacidade.");
          return;
        }
        if (r === "nao_configurado") {
          setAviso("Os lembretes ainda não estão disponíveis. Tente mais tarde.");
          return;
        }
        if (r === "indisponivel") return;
      }
      setAviso("");
      await salvar(
        { ...estado, reminders: estado.reminders.map((l) => (l.kind === kind ? { ...l, ...parte } : l)) },
        estado,
      );
    } finally {
      ocupado.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-xl py-2">
      <h2 className="text-2xl font-black tracking-tight text-ink">Lembretes</h2>
      <p className="mt-1 text-sm text-mut">
        Avisos curtos no aparelho. Eles não mostram nada sobre a sua saúde. Gerencie o consentimento em{" "}
        <Link to={ROUTES.privacidadePerfil} className="font-bold text-act-text underline">
          Perfil &gt; Privacidade
        </Link>
        .
      </p>

      {!suporte && (
        <p role="alert" className="mt-4 rounded-2xl bg-soft p-3 text-sm font-semibold text-ink">
          Este navegador não suporta notificações. No iPhone, adicione o Nuvi à tela de início para ligar os lembretes.
        </p>
      )}
      {aviso && (
        <p role="alert" className="mt-4 rounded-2xl bg-soft p-3 text-sm font-semibold text-ink">
          {aviso}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {(estado?.reminders ?? []).map((l) => (
          <li key={l.kind} className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
            <span className="flex-1 text-sm font-extrabold text-ink">{NOMES[l.kind] ?? l.kind}</span>
            <input
              type="time"
              aria-label={`Horário: ${NOMES[l.kind] ?? l.kind}`}
              value={l.time}
              disabled={!suporte}
              onChange={(e) => e.target.value && void mudar(l.kind, { time: e.target.value })}
              className="rounded-xl border border-line bg-bg px-2 py-1.5 text-sm text-ink"
            />
            <Switch
              aria-label={`Ligar lembrete: ${NOMES[l.kind] ?? l.kind}`}
              checked={l.enabled}
              disabled={!suporte}
              onCheckedChange={(v) => void mudar(l.kind, { enabled: v })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
