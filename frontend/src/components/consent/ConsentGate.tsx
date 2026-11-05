import { useEffect, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { saveConsent, subscribePedido, resolverPedido, type Purpose } from "../../lib/consents";

const TEXTOS: Partial<Record<Purpose, { titulo: string; corpo: string; detalhe: string }>> = {
  ia: {
    titulo: "Enviar para a inteligência artificial?",
    corpo:
      "Para montar cardápios, receitas e interpretar o que você escreve ou fotografa, o Nuvi envia o texto, a foto e partes do seu perfil (como metas e restrições) para o Google Gemini, em servidores nos Estados Unidos (EUA).",
    detalhe: "Sem isso, o Agente, o Gerar cardápio, o Chef e a foto da refeição não funcionam. Você pode desligar quando quiser em Perfil > Privacidade.",
  },
  push: {
    titulo: "Receber lembretes no aparelho?",
    corpo: "Para avisar da água e das refeições, guardamos o endereço de notificação do seu aparelho e enviamos os lembretes que você configurar.",
    detalhe: "Você pode desligar quando quiser em Perfil > Privacidade; ao desligar, apagamos o endereço do aparelho.",
  },
};

/**
 * Folha de consentimento por finalidade (`ia`, `push`). Fica montada uma vez no App e abre
 * quando uma tela chama `ensureConsent(...)` ou quando a API responde `403 consent_required`.
 */
export function ConsentGate() {
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => subscribePedido(setPurpose), []);

  const texto = purpose ? TEXTOS[purpose] : undefined;

  async function permitir() {
    if (!purpose) return;
    setSaving(true);
    setErro("");
    try {
      await saveConsent(purpose, true, "primeiro_uso");
      resolverPedido(true);
    } catch {
      setErro("Não foi possível registrar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={purpose !== null && !!texto}
      onOpenChange={(o) => { if (!o) resolverPedido(false); }}
      title={texto?.titulo ?? ""}
    >
      <p className="text-sm text-ink">{texto?.corpo}</p>
      <p className="mt-2 text-sm text-mut">{texto?.detalhe}</p>
      {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={permitir} disabled={saving}>Permitir</Button>
        <Button variant="ghost" onClick={() => resolverPedido(false)} disabled={saving}>Agora não</Button>
      </div>
    </Sheet>
  );
}
