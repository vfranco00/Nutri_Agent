import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { useAuth } from "../lib/AuthContext";
import { useFeedback } from "../lib/FeedbackContext";
import { isFreeText } from "../lib/utils";
import {
  type Profile as ProfileType,
  ACTIVITY_LEVELS,
  DIET_TYPES,
  GOALS,
} from "../types";
import {
  Save,
  Scale,
  Ruler,
  Calendar,
  Activity,
  Target,
  Plus,
  Info,
  Flame,
  Apple,
  CheckCircle2,
  Sparkles,
  MessageCircleQuestion,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { BouncingDots } from "../components/BouncingDots";
import { PageTitle } from "../components/PageTitle";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";

interface WeightData {
  id: number;
  weight: number;
  date: string;
}

const CAMPO =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-act-text";
const ROTULO = "flex items-center gap-2 text-xs font-bold text-mut";
const CARTAO = "rounded-3xl border border-line bg-card p-5";

const PREFERENCE_FIELDS: { key: "allergies" | "food_likes" | "food_dislikes"; label: string }[] = [
  { key: "allergies", label: "Alergias" },
  { key: "food_likes", label: "O que você MAIS gosta" },
  { key: "food_dislikes", label: "O que você DETESTA" },
];

export function Profile() {
  const { showAlert } = useAlert();
  const { refreshUser } = useAuth();
  const { openFeedbackModal } = useFeedback();
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [addingWeight, setAddingWeight] = useState(false);

  const [formData, setFormData] = useState<ProfileType>({
    age: 0,
    weight: 0,
    height: 0,
    gender: "male",
    activity_level: "sedentary",
    goal: "lose_weight",
    diet_type: "omnivore",
    allergies: "",
    food_likes: "",
    food_dislikes: "",
    eats_fruit: true,
    body_fat_goal: false,
  });

  const [history, setHistory] = useState<WeightData[]>([]);
  const [newWeight, setNewWeight] = useState("");

  // Cálculo do Peso Ideal
  const heightM = formData.height / 100;
  const minWeight = heightM > 0 ? (18.5 * heightM * heightM).toFixed(1) : 0;
  const maxWeight = heightM > 0 ? (24.9 * heightM * heightM).toFixed(1) : 0;

  useEffect(() => {
    async function loadData() {
      setFetching(true);

      // Busca o Perfil
      try {
        const profileRes = await api.get("/profiles/me");
        if (profileRes && profileRes.data) {
          setFormData(profileRes.data);
        }
      } catch (error) {
        console.warn("Perfil novo ou não encontrado.");
        console.error(error);
      }

      // Busca o Histórico de Peso
      try {
        const historyRes = await api.get("/profiles/weight/history");
        if (historyRes && Array.isArray(historyRes.data)) {
          setHistory(historyRes.data);
        } else {
          setHistory([]);
        }
      } catch (error) {
        console.warn("Sem histórico de peso ou erro na rota.");
        setHistory([]); // Fallback seguro
        console.error(error);
      } finally {
        setFetching(false);
      }
    }
    loadData();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    for (const field of PREFERENCE_FIELDS) {
      const value = formData[field.key] || "";
      if (!isFreeText(value)) {
        showAlert(
          `"${field.label}" deve conter texto (ex: nomes de alimentos), não apenas números ou símbolos.`,
          "warning",
        );
        return;
      }
    }

    setLoading(true);
    try {
      await api.put("/profiles/me", formData);
      await api.post("/profiles/weight", { weight: formData.weight });

      // Recarrega para garantir que pegamos o BMR calculado pelo backend
      const res = await api.get("/profiles/me");
      if (res && res.data) {
        setFormData(res.data);
      }

      showAlert("Perfil salvo e métricas calculadas!", "success");
      // Atualiza o usuário do AuthContext pra `has_profile` virar true sem precisar de F5
      // (é o que libera o usuário do redirecionamento forçado do onboarding).
      await refreshUser();
    } catch (error) {
      console.error(error);
      showAlert("Erro ao salvar perfil.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddWeight() {
    if (!newWeight) return;
    setAddingWeight(true);
    try {
      const weightVal = Number(newWeight);
      const res = await api.post("/profiles/weight", { weight: weightVal });

      if (res && res.data) {
        setHistory((prevHistory) => [...prevHistory, res.data]);
        setFormData((prev) => ({ ...prev, weight: weightVal }));
        setNewWeight("");
      }
    } catch (error) {
      console.error(error);
      showAlert("Erro ao registrar peso.", "error");
    } finally {
      setAddingWeight(false);
    }
  }

  if (fetching)
    return (
      <div className="mx-auto max-w-6xl space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl">
      {isOnboarding && (
        <div className="mb-6 flex items-start gap-3 rounded-3xl bg-act-soft p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-act-text" />
          <div>
            <h2 className="text-sm font-extrabold text-ink">Vamos começar!</h2>
            <p className="text-sm text-ink">
              Preencha seus dados pra gente calcular suas metas e personalizar tudo pra você.
            </p>
          </div>
        </div>
      )}

      <PageTitle a="Suas" b="metas" />
      <a href="/perfil/privacidade" className="hit44 -mt-2 mb-6 inline-block text-sm font-extrabold text-act-text underline">
        Privacidade e meus dados
      </a>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <form onSubmit={handleSave} className={`${CARTAO} space-y-6`}>
            <h2 className="text-[17px] font-extrabold text-ink">Dados Corporais</h2>

            <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl bg-soft p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-act-text" />
                <div>
                  <h4 className="text-sm font-extrabold text-ink">Estimativa de Peso Ideal</h4>
                  {formData.height > 0 ? (
                    <p className="mt-1 text-xs text-mut">
                      Faixa saudável: <strong className="text-ink">{minWeight}kg</strong> -{" "}
                      <strong className="text-ink">{maxWeight}kg</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-mut">Preencha sua altura</p>
                  )}
                </div>
              </div>

              {formData.bmr ? (
                <div className="flex items-start gap-3 rounded-2xl bg-soft p-4">
                  <Flame className="mt-0.5 h-5 w-5 shrink-0 text-act-text" />
                  <div>
                    <h4 className="text-sm font-extrabold text-ink">Metabolismo Basal</h4>
                    <p className="mt-1 text-xs text-mut">
                      Seu corpo gasta <strong className="text-ink">{Math.round(formData.bmr)} kcal</strong> em
                      repouso.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line p-4 text-mut">
                  <Activity className="h-5 w-5" />
                  <span className="text-xs">Salve para calcular sua TMB.</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-3">
              <div className="space-y-2">
                <label className={ROTULO}>
                  <Calendar className="h-4 w-4" /> Idade
                </label>
                <input
                  type="number"
                  required
                  value={formData.age || ""}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                  className={CAMPO}
                />
              </div>
              <div className="space-y-2">
                <label className={ROTULO}>
                  <Scale className="h-4 w-4" /> Peso (kg)
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  value={formData.weight || ""}
                  onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                  className={CAMPO}
                />
              </div>
              <div className="space-y-2">
                <label className={ROTULO}>
                  <Ruler className="h-4 w-4" /> Altura (cm)
                </label>
                <input
                  type="number"
                  required
                  value={formData.height || ""}
                  onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                  className={CAMPO}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2">
              <div className="space-y-2">
                <label className={ROTULO}>
                  <Activity className="h-4 w-4" /> Nível de Atividade
                </label>
                <select
                  value={formData.activity_level}
                  onChange={(e) => setFormData({ ...formData, activity_level: e.target.value as any })}
                  className={CAMPO}
                >
                  {Object.entries(ACTIVITY_LEVELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className={ROTULO}>
                  <Target className="h-4 w-4" /> Objetivo
                </label>
                <select
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value as any })}
                  className={CAMPO}
                >
                  {Object.entries(GOALS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
              <div
                onClick={() => setFormData({ ...formData, eats_fruit: !formData.eats_fruit })}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${formData.eats_fruit ? "border-pos bg-pos-soft" : "border-line bg-soft"}`}
              >
                <div className="rounded-full bg-card p-2">
                  <Apple className={`h-5 w-5 ${formData.eats_fruit ? "text-pos-text" : "text-mut"}`} />
                </div>
                <span className="flex-1 text-sm font-bold text-ink">Consumo Frutas</span>
                {formData.eats_fruit && <CheckCircle2 className="h-5 w-5 text-pos-text" />}
              </div>

              <div
                onClick={() => setFormData({ ...formData, body_fat_goal: !formData.body_fat_goal })}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${formData.body_fat_goal ? "border-act bg-act-soft" : "border-line bg-soft"}`}
              >
                <div className="rounded-full bg-card p-2">
                  <Target className={`h-5 w-5 ${formData.body_fat_goal ? "text-act-text" : "text-mut"}`} />
                </div>
                <span className="flex-1 text-sm font-bold text-ink">Focar em % Gordura</span>
                {formData.body_fat_goal && <CheckCircle2 className="h-5 w-5 text-act-text" />}
              </div>
            </div>

            <div className="space-y-4 border-t border-line pt-4">
              <h3 className="text-[17px] font-extrabold text-ink">Preferências Alimentares</h3>
              <div className="space-y-2">
                <label className={ROTULO}>Tipo de Dieta</label>
                <select
                  value={formData.diet_type || "omnivore"}
                  onChange={(e) => setFormData({ ...formData, diet_type: e.target.value })}
                  className={CAMPO}
                >
                  {Object.entries(DIET_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className={ROTULO}>Alergias (Separar por vírgula)</label>
                <input
                  type="text"
                  value={formData.allergies || ""}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className={CAMPO}
                />
              </div>
              <div className="space-y-2">
                <label className={ROTULO}>O que você MAIS gosta?</label>
                <textarea
                  rows={2}
                  value={formData.food_likes || ""}
                  onChange={(e) => setFormData({ ...formData, food_likes: e.target.value })}
                  className={`${CAMPO} resize-none`}
                />
              </div>
              <div className="space-y-2">
                <label className={ROTULO}>O que você DETESTA?</label>
                <textarea
                  rows={2}
                  value={formData.food_dislikes || ""}
                  onChange={(e) => setFormData({ ...formData, food_dislikes: e.target.value })}
                  className={`${CAMPO} resize-none`}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <BouncingDots /> : <><Save className="h-5 w-5" /> Salvar Perfil e Histórico</>}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <button
            type="button"
            onClick={() => openFeedbackModal()}
            className={`${CARTAO} flex w-full items-center gap-3 text-left`}
          >
            <MessageCircleQuestion className="h-5 w-5 shrink-0 text-act-text" aria-hidden="true" />
            <span className="flex-1 text-[17px] font-extrabold text-ink">Ajuda e sugestões</span>
          </button>

          <div className={CARTAO}>
            <h3 className="mb-4 flex items-center gap-2 text-[17px] font-extrabold text-ink">
              <Scale className="h-5 w-5 text-act-text" /> Pesagem Rápida
            </h3>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Peso hoje (kg)"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className={`${CAMPO} flex-1`}
              />
              <Button onClick={handleAddWeight} disabled={addingWeight} aria-label="Registrar peso" className="px-3">
                {addingWeight ? <BouncingDots /> : <Plus className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <div className={`${CARTAO} h-80`}>
            <h3 className="mb-4 text-sm font-bold text-mut">Evolução do Peso</h3>

            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--mut)"
                    fontSize={12}
                    tickFormatter={(str) => format(new Date(str), "dd/MM")}
                  />
                  <YAxis stroke="var(--mut)" fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--line)",
                      borderRadius: "12px",
                      color: "var(--ink)",
                    }}
                    labelFormatter={(label) => format(new Date(label), "dd/MM/yyyy HH:mm")}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--act)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    dot={{ r: 3, fill: "var(--act)", stroke: "var(--act)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-mut">
                Registre seu peso para ver o gráfico
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
