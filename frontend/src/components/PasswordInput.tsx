import { useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  icon: ReactNode;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className: string;
  toggleClassName?: string;
  placeholder?: string;
  required?: boolean;
}

/**
 * Input de senha com botão de olhinho pra alternar entre mostrar/ocultar o texto.
 * `icon` e `className` ficam por conta de quem chama pra cada tela poder manter
 * o próprio esquema de cores (algumas telas têm suporte a tema claro, outras não).
 */
export function PasswordInput({
  icon,
  value,
  onChange,
  className,
  toggleClassName = "text-zinc-500 hover:text-zinc-300",
  placeholder,
  required,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {icon}
      <input
        type={visible ? "text" : "password"}
        required={required}
        value={value}
        onChange={onChange}
        className={className}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className={`absolute right-3 top-3 transition-colors ${toggleClassName}`}
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
