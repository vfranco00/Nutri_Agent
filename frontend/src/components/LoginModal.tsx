import { useEffect } from "react";
import { X } from "lucide-react";
import { LoginForm } from "./LoginForm";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de login estilo Sympla: caixa centralizada com fundo borrado. Usado na home —
 * o cadastro continua sendo uma tela separada (/register).
 */
export function LoginModal({ open, onClose }: LoginModalProps) {
  // Fecha no ESC e trava o scroll do fundo enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <LoginForm />
      </div>
    </div>
  );
}
