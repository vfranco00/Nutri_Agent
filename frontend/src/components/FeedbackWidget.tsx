import { useState } from "react";
import { LifeBuoy, X, Send, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useAlert } from "../lib/AlertContext";
import { useFeedback } from "../lib/FeedbackContext";

const CATEGORIES = [
  { value: "duvida", label: "Dúvida" },
  { value: "bug", label: "Bug" },
  { value: "sugestao", label: "Sugestão" },
  { value: "outro", label: "Outro" },
];

export function FeedbackWidget() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { isOpen, openFeedbackModal, closeFeedbackModal } = useFeedback();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("duvida");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function handleOpen() {
    setName(user?.full_name || "");
    setEmail(user?.email || "");
    openFeedbackModal();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/feedback/", { name: name || undefined, email, category, message });
      showAlert("Chamado enviado! A gente responde no seu email.", "success");
      setMessage("");
      closeFeedbackModal();
    } catch (error: any) {
      showAlert("Erro ao enviar o chamado. Tente de novo em instantes.", "error");
      console.error(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 bg-green-600 hover:bg-green-700 text-white p-4 rounded-full shadow-lg shadow-green-900/30 transition-all hover:scale-105"
        title="Ajuda e feedback"
      >
        <LifeBuoy className="h-6 w-6" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-green-500" /> Ajuda &amp; Feedback
              </h3>
              <button
                onClick={closeFeedbackModal}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none dark:text-white focus:ring-2 focus:ring-green-500"
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none dark:text-white focus:ring-2 focus:ring-green-500"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none dark:text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Mensagem</label>
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none dark:text-white resize-none focus:ring-2 focus:ring-green-500"
                  placeholder="Conta pra gente o que aconteceu ou o que você gostaria de ver..."
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
