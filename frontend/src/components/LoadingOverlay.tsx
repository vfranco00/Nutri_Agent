import { useEffect, useState } from "react";
import { Loader2, Lightbulb } from "lucide-react";
import { getRandomTip } from "../lib/tips";

export function LoadingOverlay({ text }: { text: string }) {
  const [tip, setTip] = useState(() => getRandomTip());

  useEffect(() => {
    const interval = setInterval(() => {
      setTip((current) => getRandomTip(current));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn px-6">
      <Loader2 className="h-16 w-16 text-purple-500 animate-spin mb-6" />
      <h3 className="text-xl font-bold text-white mb-2">Um momento...</h3>
      <p className="text-zinc-400 animate-pulse mb-8">{text}</p>

      <div className="max-w-md w-full bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 p-5 rounded-xl flex gap-3 items-start">
        <Lightbulb className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-purple-300 text-sm mb-1">
            Dica do NutriAgent
          </h4>
          <p className="text-purple-200/80 text-sm italic">"{tip}"</p>
        </div>
      </div>
    </div>
  );
}
