import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { getNavItems } from "../lib/navItems";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Busca rápida (⌘/Ctrl + K): abre um modal com todas as telas, filtra ao digitar,
 * navega com as setas + Enter. O atalho de teclado é registrado no AppLayout.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => getNavItems(!!user?.is_superuser), [user?.is_superuser]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.keywords || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  // Reseta ao abrir e foca o campo.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  function go(path: string) {
    navigate(path);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) go(item.path);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="h-5 w-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pular para..."
            className="flex-1 bg-transparent py-3.5 outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
          <kbd className="text-[10px] text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-72 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">Nada encontrado para "{query}".</p>
          ) : (
            results.map((item, i) => (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-sm text-zinc-800 dark:text-zinc-200 flex-1">{item.name}</span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-zinc-400" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
