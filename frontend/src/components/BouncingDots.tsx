interface BouncingDotsProps {
  className?: string;
}

/**
 * Três pontinhos pulando em sequência — feedback de loading leve pra dentro de
 * botões/caixas, sem precisar de overlay de tela cheia. Usa `bg-current` pra
 * herdar a cor do texto de quem chama (ex: `text-white` num botão colorido).
 */
export function BouncingDots({ className = "" }: BouncingDotsProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
    </span>
  );
}
