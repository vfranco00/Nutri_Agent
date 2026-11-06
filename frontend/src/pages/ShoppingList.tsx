import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useSubscription } from "../lib/SubscriptionContext";
import type { ShoppingList } from "../types";
import { Check, Loader2, Lock, Plus, Sparkles, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { BouncingDots } from "../components/BouncingDots";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { ROUTES } from "../routes";

export function ShoppingPage() {
  const navigate = useNavigate();
  const { showAlert, confirmDialog } = useAlert();
  const { subscription } = useSubscription();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newListTitle, setNewListTitle] = useState("");
  const [newItemNames, setNewItemNames] = useState<Record<number, string>>({}); // Estado por lista
  const [creatingList, setCreatingList] = useState(false);
  const [deletingListId, setDeletingListId] = useState<number | null>(null);

  // Carregar listas
  async function loadLists() {
    setLoading(true);
    try {
      const res = await api.get("/shopping/");
      
      if (res && Array.isArray(res.data)) {
        // Blindagem Nível 2: Garante que cada lista tenha o array "items" válido
        const safeLists = res.data.map(list => ({
          ...list,
          items: Array.isArray(list.items) ? list.items : []
        }));
        setLists(safeLists);
      } else {
        setLists([]);
      }
    } catch (error) {
      console.warn("Sem listas de compras ou erro na rota.");
      setLists([]); // Fallback seguro
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLists();
  }, []);

  // Criar Lista
  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListTitle) return;
    setCreatingList(true);
    try {
      const res = await api.post("/shopping/", { title: newListTitle });

      if (res && res.data) {
        // Garante que a lista nova já nasça com array de itens vazio caso o back não mande
        const newList = {
          ...res.data,
          items: Array.isArray(res.data.items) ? res.data.items : []
        };
        setLists([newList, ...lists]);
        setNewListTitle("");
      }
    } catch (error) {
      showAlert("Erro ao criar lista", "error");
      console.error(error);
    } finally {
      setCreatingList(false);
    }
  }

  // Deletar Lista
  async function handleDeleteList(id: number) {
    if (!(await confirmDialog("Apagar lista?", { danger: true }))) return;
    setDeletingListId(id);
    try {
      await api.delete(`/shopping/${id}`);
      setLists(lists.filter((l) => l.id !== id));
    } catch (error) {
      showAlert("Erro ao apagar", "error");
      console.error(error);
    } finally {
      setDeletingListId(null);
    }
  }

  // Adicionar Item
  async function handleAddItem(listId: number) {
    const name = newItemNames[listId];
    if (!name) return;
    try {
      const res = await api.post(`/shopping/${listId}/items`, { name });

      if (res && res.data) {
        const updatedLists = lists.map((list) => {
          if (list.id === listId) {
            // Se previne contra list.items ser undefined
            const currentItems = Array.isArray(list.items) ? list.items : [];
            return { ...list, items: [...currentItems, res.data] };
          }
          return list;
        });
        setLists(updatedLists);
        setNewItemNames({ ...newItemNames, [listId]: "" });
      }
    } catch (error) {
      showAlert("Erro ao adicionar item", "error");
      console.error(error);
    }
  }

  // Check/Uncheck Item
  async function handleToggleItem(itemId: number, listId: number) {
    try {
      await api.patch(`/shopping/items/${itemId}/toggle`);

      const updatedLists = lists.map((list) => {
        if (list.id === listId) {
          const currentItems = Array.isArray(list.items) ? list.items : [];
          const updatedItems = currentItems.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item,
          );
          return { ...list, items: updatedItems };
        }
        return list;
      });
      setLists(updatedLists);
    } catch (error) {
      console.error("Erro ao alterar status do item:", error);
    }
  }

  // Deletar Item
  async function handleDeleteItem(itemId: number, listId: number) {
    try {
      await api.delete(`/shopping/items/${itemId}`);
      
      const updatedLists = lists.map((list) => {
        if (list.id === listId) {
          const currentItems = Array.isArray(list.items) ? list.items : [];
          return { ...list, items: currentItems.filter((i) => i.id !== itemId) };
        }
        return list;
      });
      setLists(updatedLists);
    } catch (error) {
      console.error("Erro ao deletar item:", error);
    }
  }

  const voltar = (
    <button
      type="button"
      onClick={() => navigate(ROUTES.cardapios)}
      aria-label="Voltar"
      className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-card active:scale-[.97]"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  if (subscription && !subscription.shopping_list_access) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex items-center gap-3">
          {voltar}
          <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em]">
            Lista <span className="text-act-text">do mercado</span>
          </h1>
        </div>
        <div className="rounded-3xl bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-act-soft">
            <Lock className="h-7 w-7 text-act-text" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-lg font-extrabold">Disponível a partir do plano Plus</h2>
          <p className="mb-6 text-sm text-mut">
            No plano Starter a lista de compras fica bloqueada. Faça upgrade pra organizar suas compras direto do
            cardápio.
          </p>
          <Button onClick={() => navigate(ROUTES.assinatura)}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Ver planos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-1">
      <div className="flex items-center gap-3">
        {voltar}
        <div>
          <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.025em]">
            Lista <span className="text-act-text">do mercado</span>
          </h1>
        </div>
      </div>

      {/* Criar nova lista */}
      <form onSubmit={handleCreateList} className="mt-3 flex gap-2 rounded-3xl bg-card p-3">
        <Input
          type="text"
          aria-label="Nome da nova lista"
          placeholder="Nome da nova lista (ex: Churrasco de Domingo)"
          value={newListTitle}
          onChange={(e) => setNewListTitle(e.target.value)}
        />
        <Button type="submit" disabled={creatingList} className="shrink-0">
          {creatingList ? (
            <BouncingDots />
          ) : (
            <>
              <Plus className="h-5 w-5" aria-hidden="true" /> Criar
            </>
          )}
        </Button>
      </form>

      {loading ? (
        <div aria-hidden="true" className="space-y-2 pt-3">
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-4 pt-3">
          {lists.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center">
              <p className="text-sm font-extrabold">Nenhuma lista ainda.</p>
              <p className="mt-1 text-sm text-mut">Crie uma acima ou gere uma a partir do seu cardápio.</p>
            </div>
          )}
          {lists.map((list) => {
            const feitos = list.items.filter((i) => i.checked).length;
            const pct = list.items.length ? (feitos / list.items.length) * 100 : 0;
            return (
              <section key={list.id} aria-label={list.title}>
                <div className="flex items-start justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-extrabold">{list.title}</h2>
                    <p className="text-[13px] font-semibold text-mut">
                      {list.items.length} itens · {feitos} no carrinho ·{" "}
                      {format(new Date(list.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteList(list.id)}
                    disabled={deletingListId === list.id}
                    aria-label={`Apagar ${list.title}`}
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-card text-mut active:scale-[.97] disabled:opacity-50"
                  >
                    {deletingListId === list.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <div
                  role="progressbar"
                  aria-label="Itens no carrinho"
                  aria-valuemin={0}
                  aria-valuemax={list.items.length}
                  aria-valuenow={feitos}
                  className="mx-1 my-2.5 h-2 overflow-hidden rounded bg-soft"
                >
                  <div className="h-full rounded bg-pos transition-[width] duration-300" style={{ width: `${pct}%` }} />
                </div>

                <ul className="overflow-hidden rounded-[22px] bg-card">
                  {list.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.checked}
                        onClick={() => handleToggleItem(item.id, list.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 ${
                            item.checked ? "border-pos bg-pos text-nuvi-tinta" : "border-line"
                          }`}
                        >
                          {item.checked && <Check className="h-[15px] w-[15px]" aria-hidden="true" />}
                        </span>
                        <span className={`text-sm font-bold ${item.checked ? "text-mut line-through" : ""}`}>
                          {item.name}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id, list.id)}
                        aria-label={`Remover ${item.name}`}
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-mut"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}

                  <li className="flex items-center gap-2 px-3.5 py-2.5">
                    <input
                      type="text"
                      aria-label={`Adicionar item em ${list.title}`}
                      placeholder="Adicionar item..."
                      value={newItemNames[list.id] || ""}
                      onChange={(e) => setNewItemNames({ ...newItemNames, [list.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleAddItem(list.id)}
                      className="min-w-0 flex-1 bg-transparent py-1.5 text-sm font-semibold text-ink placeholder:text-mut focus-visible:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddItem(list.id)}
                      aria-label="Adicionar item"
                      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-xl bg-act text-on-act active:scale-[.97]"
                    >
                      <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                  </li>
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
