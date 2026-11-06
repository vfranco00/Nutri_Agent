/**
 * Limpa a `msg` de um 422 do Pydantic para mostrar ao usuário: tira o prefixo
 * técnico "Value error, " e traduz a mensagem do e-mail inválido (que vem em inglês
 * do email-validator).
 */
export function limparMensagemValidacao(msg: string | undefined | null): string {
  if (!msg) return "";
  const semPrefixo = msg.replace(/^Value error,\s*/i, "").trim();
  if (/not a valid email address/i.test(semPrefixo)) return "Informe um e-mail válido.";
  return semPrefixo;
}
