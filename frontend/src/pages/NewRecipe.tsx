import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAlert } from '../lib/AlertContext';
import { Save, Clock, Flame, Type, AlignLeft, Plus, Trash2, Carrot, ArrowLeft, Settings2, Tag, Users } from 'lucide-react';
import { CATEGORIES } from '../types';
import { BouncingDots } from '../components/BouncingDots';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/ui/Button';
import { Switch } from '../components/ui/Switch';
import { ROUTES } from '../routes';

interface IngredientInput { name: string; quantity: string; unit: string; calories?: number; }

const PREP_METHODS = [
  { value: 'fogao', label: 'Fogão' },
  { value: 'forno', label: 'Forno' },
  { value: 'airfryer', label: 'Airfryer' },
  { value: 'microondas', label: 'Microondas' },
  { value: 'cru', label: 'Não vai ao fogo (Cru)' },
];

const CAMPO = 'min-w-0 w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-act-text';
const CAMPO_P = 'rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-act-text';
const ROTULO = 'flex items-center gap-2 text-xs font-bold text-mut';
const CARTAO = 'space-y-4 rounded-3xl border border-line bg-card p-5';

const RECIPE_CATEGORIES = Object.entries(CATEGORIES).filter(([key]) => key !== 'all');

export function NewRecipe() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [calculatingIndex, setCalculatingIndex] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [totalCalories, setTotalCalories] = useState('');
  const [method, setMethod] = useState('fogao');
  const [category, setCategory] = useState('almoco');
  // Receita nova nasce privada; publicar na Comunidade é uma escolha explícita do usuário.
  const [isPublic, setIsPublic] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientInput[]>([{ name: '', quantity: '', unit: '', calories: 0 }]);

  async function calculateIngredientCalories(index: number) {
    const ing = ingredients[index];
    if (!ing.name || !ing.quantity || !ing.unit) return;
    if (ing.calories && ing.calories > 0) return;

    try {
      setCalculatingIndex(index);
      const response = await api.post('/ai/calculate-calories', { name: ing.name, quantity: Number(ing.quantity), unit: ing.unit });

      const kcal = response.data.total_calories;

      const newList = [...ingredients];
      newList[index].calories = response.data.total_calories;

      if (kcal > 0) {
        newList[index].calories = kcal;
      } else {
        console.log("IA não encontrou calorias para " + ing.name);
      }

      setIngredients(newList);
      const newTotal = newList.reduce((sum, item) => sum + (item.calories || 0), 0);
      setTotalCalories(String(Math.round(newTotal)));
    } catch (error) { console.error(error); } finally { setCalculatingIndex(null); }
  }

  function addIngredient() { setIngredients([...ingredients, { name: '', quantity: '', unit: '', calories: 0 }]); }
  function removeIngredient(index: number) {
    if (ingredients.length === 1) return;
    const newList = ingredients.filter((_, i) => i !== index);
    setIngredients(newList);
    setTotalCalories(String(Math.round(newList.reduce((sum, item) => sum + (item.calories || 0), 0))));
  }
  function updateIngredient(index: number, field: keyof IngredientInput, value: string) {
    const newList = [...ingredients];
    // @ts-ignore
    newList[index][field] = value;
    setIngredients(newList);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const validIngredients = ingredients.filter(ing => ing.name.trim() !== '' && ing.quantity !== '').map(ing => ({
        name: ing.name, quantity: Number(ing.quantity), unit: ing.unit || 'un'
      }));
      await api.post('/recipes/', {
        title, instructions, prep_time: Number(prepTime) || 0, calories: Number(totalCalories) || 0, preparation_method: method, category, ingredients: validIngredients,
        is_public: isPublic,
      });
      navigate(ROUTES.receitas);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      showAlert(detail?.code === 'PLAN_LIMIT_REACHED' ? detail.message : 'Erro ao criar.', 'error');
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(ROUTES.receitas)} aria-label="Voltar" className="-ml-2 mb-2 flex h-10 w-10 items-center justify-center rounded-2xl text-ink hover:bg-soft">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <PageTitle a="Nova" b="receita" />

      <form onSubmit={handleSave} className="space-y-4">
        <div className={CARTAO}>
          <div className="space-y-2">
            <label className={ROTULO}><Type className="h-4 w-4" /> Nome</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className={CAMPO} placeholder="Ex: Omelete" />
          </div>
          <div className="grid grid-cols-2 gap-4 [&>*]:min-w-0">
            <div className="space-y-2">
              <label className={ROTULO}><Clock className="h-4 w-4" /> Tempo (min)</label>
              <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} className={CAMPO} />
            </div>
            <div className="space-y-2">
              <label className={ROTULO}><Flame className="h-4 w-4" /> Calorias</label>
              <input type="number" value={totalCalories} onChange={e => setTotalCalories(e.target.value)} className={CAMPO} placeholder="Auto" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 [&>*]:min-w-0">
            <div className="space-y-2">
              <label className={ROTULO}><Settings2 className="h-4 w-4" /> Preparo</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className={CAMPO}>
                {PREP_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className={ROTULO}><Tag className="h-4 w-4" /> Categoria</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={CAMPO}>
                {RECIPE_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className={CARTAO}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-ink"><Carrot className="h-5 w-5 text-act-text" /> Ingredientes</h2>
            <button type="button" onClick={addIngredient} className="flex items-center gap-1 text-sm font-extrabold text-act-text"><Plus className="h-4 w-4" /> Adicionar</button>
          </div>
          <div className="space-y-3">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <input placeholder="Nome" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} onBlur={() => calculateIngredientCalories(i)} className={`${CAMPO_P} min-w-0 flex-1`} />
                <input type="number" placeholder="Qtd" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)} onBlur={() => calculateIngredientCalories(i)} className={`${CAMPO_P} w-16 sm:w-20`} />
                <input placeholder="Un" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} onBlur={() => calculateIngredientCalories(i)} className={`${CAMPO_P} w-14 sm:w-20`} />
                <div className="flex w-14 justify-end text-xs font-semibold text-mut">
                  {calculatingIndex === i ? (
                    <BouncingDots />
                  ) : (
                    ing.calories ? `${Math.round(ing.calories)} kcal` : '-'
                  )}
                </div>
                <button type="button" onClick={() => removeIngredient(i)} aria-label="Remover ingrediente" className="p-1 text-mut hover:text-ink"><Trash2 className="h-5 w-5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className={CARTAO}>
          <label className={ROTULO}><AlignLeft className="h-4 w-4" /> Modo de Preparo</label>
          <textarea required rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} className={`${CAMPO} resize-none`} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-card p-5">
          <span className="text-sm">
            <span className="flex items-center gap-2 font-extrabold text-ink">
              <Users className="h-4 w-4" /> Publicar na Comunidade (seu primeiro nome aparece como autor)
            </span>
            <span className="mt-1 block text-mut">
              Outras pessoas poderão ver o título, os ingredientes e o modo de preparo.
              Desligado, a receita fica só sua.
            </span>
          </span>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label="Publicar na Comunidade" />
        </div>

        <Button type="submit" disabled={loading} className="w-full py-4">
          {loading ? <BouncingDots /> : <><Save className="h-5 w-5" /> Criar Receita</>}
        </Button>
      </form>
    </div>
  );
}
