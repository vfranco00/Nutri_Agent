/**
 * Interruptor único da IA do Nuvi (Agente, gerar cardápio, Chef, trocar refeição, lista de compras por IA,
 * calorias de ingrediente e "Estimar com IA").
 *
 * Desligado por padrão: as telas mostram "Em breve" e nenhuma chamada à API de IA é feita.
 * Para religar, cadastre `VITE_IA_ATIVA=true` nas variáveis do projeto `nuvi` da Vercel e faça um novo deploy
 * (a variável é lida no build).
 */
export const IA_DISPONIVEL: boolean = import.meta.env.VITE_IA_ATIVA === "true";
