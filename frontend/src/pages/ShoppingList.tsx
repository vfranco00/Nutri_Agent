import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ShoppingList } from '../types';
import { Plus, Trash2, Calendar, CheckCircle, Circle, ShoppingCart, Loader2 , ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function ShoppingPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newListTitle, setNewListTitle] = useState('');
  const [newItemNames, setNewItemNames] = useState<Record<number, string>>({}); // Estado por lista

  // Carregar listas
  async function loadLists() {
    try {
      const res = await api.get('/shopping/');
      setLists(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLists(); }, []);

  // Criar Lista
  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListTitle) return;
    try {
      const res = await api.post('/shopping/', { title: newListTitle });
      setLists([res.data, ...lists]);
      setNewListTitle('');
    } catch (error) { alert('Erro ao criar lista'); }
  }

  // Deletar Lista
  async function handleDeleteList(id: number) {
    if (!confirm('Apagar lista?')) return;
    try {
      await api.delete(`/shopping/${id}`);
      setLists(lists.filter(l => l.id !== id));
    } catch (error) { alert('Erro ao apagar'); }
  }

  // Adicionar Item
  async function handleAddItem(listId: number) {
    const name = newItemNames[listId];
    if (!name) return;
    try {
      const res = await api.post(`/shopping/${listId}/items`, { name });
      
      // Atualiza estado local complexo (nested array)
      const updatedLists = lists.map(list => {
        if (list.id === listId) {
          return { ...list, items: [...list.items, res.data] };
        }
        return list;
      });
      setLists(updatedLists);
      setNewItemNames({ ...newItemNames, [listId]: '' });
    } catch (error) { alert('Erro ao adicionar item'); }
  }

  // Check/Uncheck Item
  async function handleToggleItem(itemId: number, listId: number) {
    try {
      await api.patch(`/shopping/items/${itemId}/toggle`);
      
      const updatedLists = lists.map(list => {
        if (list.id === listId) {
          const updatedItems = list.items.map(item => 
            item.id === itemId ? { ...item, checked: !item.checked } : item
          );
          return { ...list, items: updatedItems };
        }
        return list;
      });
      setLists(updatedLists);
    } catch (error) { console.error(error); }
  }

  // Deletar Item
  async function handleDeleteItem(itemId: number, listId: number) {
    try {
      await api.delete(`/shopping/items/${itemId}`);
      const updatedLists = lists.map(list => {
        if (list.id === listId) {
          return { ...list, items: list.items.filter(i => i.id !== itemId) };
        }
        return list;
      });
      setLists(updatedLists);
    } catch (error) { console.error(error); }
  }

  return (
    <div className="max-w-4xl mx-auto">

      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
        </button>
        <h1 className="text-2xl font-bold text-pink-500 mb-8 flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" /> Chef IA
        </h1>
      </div>

      {/* Criar Nova Lista */}
      <form onSubmit={handleCreateList} className="flex gap-4 mb-8 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <input 
          type="text" 
          placeholder="Nome da nova lista (ex: Churrasco de Domingo)" 
          value={newListTitle}
          onChange={e => setNewListTitle(e.target.value)}
          className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 outline-none dark:text-white focus:ring-2 focus:ring-pink-500"
        />
        <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white px-6 rounded-lg font-bold flex items-center gap-2">
          <Plus className="h-5 w-5" /> Criar
        </button>
      </form>

      {loading ? <div className="flex justify-center"><Loader2 className="animate-spin text-pink-500 h-8 w-8"/></div> : (
        <div className="space-y-6">
          {lists.map(list => (
            <div key={list.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              {/* Header da Lista */}
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg dark:text-white">{list.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(list.created_at), "dd 'de' MMMM 'às' HH:mm")}
                  </div>
                </div>
                <button onClick={() => handleDeleteList(list.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              {/* Itens */}
              <div className="p-4 space-y-2">
                {list.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between group">
                    <div 
                      onClick={() => handleToggleItem(item.id, list.id)}
                      className="flex items-center gap-3 cursor-pointer select-none flex-1"
                    >
                      {item.checked ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />}
                      <span className={`${item.checked ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-200'} transition-all`}>
                        {item.name}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteItem(item.id, list.id)} className="text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Input de Novo Item */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                  <input 
                    type="text" 
                    placeholder="Adicionar item..." 
                    value={newItemNames[list.id] || ''}
                    onChange={e => setNewItemNames({...newItemNames, [list.id]: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && handleAddItem(list.id)}
                    className="flex-1 bg-transparent border-b border-zinc-200 dark:border-zinc-700 px-2 py-1 outline-none focus:border-pink-500 dark:text-zinc-300 text-sm"
                  />
                  <button onClick={() => handleAddItem(list.id)} className="text-pink-500 hover:text-pink-400">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}