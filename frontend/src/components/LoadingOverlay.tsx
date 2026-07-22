import { useEffect, useState } from "react";
import { Loader2, Lightbulb } from "lucide-react";
import { getRandomTip } from "../lib/tips";

// Classes completas por variante (não dá pra montar `text-${color}-500` em
// runtime — o Tailwind precisa achar a string inteira no código pra não
// descartar a classe no build).
const COLOR_VARIANTS = {
  purple: {
    icon: "text-purple-500",
    box: "bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20",
    lightbulb: "text-purple-700 dark:text-purple-400",
    label: "text-purple-900 dark:text-purple-300",
    quote: "text-purple-950 dark:text-purple-200/80",
  },
  blue: {
    icon: "text-blue-500",
    box: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
    lightbulb: "text-blue-700 dark:text-blue-400",
    label: "text-blue-900 dark:text-blue-300",
    quote: "text-blue-950 dark:text-blue-200/80",
  },
  teal: {
    icon: "text-teal-500",
    box: "bg-teal-50 dark:bg-teal-500/10 border-teal-100 dark:border-teal-500/20",
    lightbulb: "text-teal-700 dark:text-teal-400",
    label: "text-teal-900 dark:text-teal-300",
    quote: "text-teal-950 dark:text-teal-200/80",
  },
} as const;

interface LoadingOverlayProps {
  text: string;
  color?: keyof typeof COLOR_VARIANTS;
}

export function LoadingOverlay({ text, color = "purple" }: LoadingOverlayProps) {
  const [tip, setTip] = useState(() => getRandomTip());
  const variant = COLOR_VARIANTS[color];

  useEffect(() => {
    const interval = setInterval(() => {
      setTip((current) => getRandomTip(current));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn px-6">
      <Loader2 className={`h-16 w-16 animate-spin mb-6 ${variant.icon}`} />
      <h3 className="text-xl font-bold text-white mb-2">Um momento...</h3>
      <p className="text-zinc-400 animate-pulse mb-8">{text}</p>

      <div className={`max-w-md w-full p-5 rounded-xl flex gap-3 items-start border ${variant.box}`}>
        <Lightbulb className={`h-5 w-5 shrink-0 mt-0.5 ${variant.lightbulb}`} />
        <div>
          <h4 className={`font-bold text-sm mb-1 ${variant.label}`}>
            Dica do NutriAgent
          </h4>
          <p className={`text-sm italic ${variant.quote}`}>"{tip}"</p>
        </div>
      </div>
    </div>
  );
}
