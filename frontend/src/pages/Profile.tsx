import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAlert } from "../lib/AlertContext";
import { isFreeText } from "../lib/utils";
import {
  type Profile as ProfileType,
  ACTIVITY_LEVELS,
  DIET_TYPES,
  GOALS,
} from "../types";
import {
  Save,
  Loader2,
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
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface WeightData {
  id: number;
  weight: number;
  date: string;
}

const PREFERENCE_FIELDS: { key: "allergies" | "food_likes" | "food_dislikes"; label: string }[] = [
  { key: "allergies", label: "Alergias" },
  { key: "food_likes", label: "O que você MAIS gosta" },
  { key: "food_dislikes", label: "O que você DETESTA" },
];

export function Profile() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

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
    } catch (error) {
      console.error(error);
      showAlert("Erro ao salvar perfil.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddWeight() {
    if (!newWeight) return;
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
    }
  }

  if (fetching)
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="animate-spin h-8 w-8 text-green-500" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-green-600 dark:text-green-500 mb-6">
        Meu Perfil Nutricional
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1: Formulário (Esquerda) */}
        <div className="lg:col-span-2 space-y-6">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold dark:text-zinc-100">
              Dados Corporais
            </h2>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Peso Ideal */}
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-lg flex gap-3 items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-blue-700 dark:text-blue-300 text-sm">
                    Estimativa de Peso Ideal
                  </h4>
                  {formData.height > 0 ? (
                    <p className="text-blue-600/80 dark:text-blue-200/70 text-xs mt-1">
                      Faixa saudável: <strong>{minWeight}kg</strong> -{" "}
                      <strong>{maxWeight}kg</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-blue-400">Preencha sua altura</p>
                  )}
                </div>
              </div>

              {/* TMB (Basal) */}
              {formData.bmr ? (
                <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-4 rounded-lg flex gap-3 items-start">
                  <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-orange-700 dark:text-orange-300 text-sm">
                      Metabolismo Basal
                    </h4>
                    <p className="text-orange-600/80 dark:text-orange-200/70 text-xs mt-1">
                      Seu corpo gasta{" "}
                      <strong>{Math.round(formData.bmr)} kcal</strong> em
                      repouso.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 rounded-lg flex gap-3 items-center text-zinc-500">
                  <Activity className="h-5 w-5" />
                  <span className="text-xs">Salve para calcular sua TMB.</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2">
                  <Calendar className="h-4 w-4" /> Idade
                </label>
                <input
                  type="number"
                  required
                  value={formData.age || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, age: Number(e.target.value) })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2">
                  <Scale className="h-4 w-4" /> Peso (kg)
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  value={formData.weight || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, weight: Number(e.target.value) })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2">
                  <Ruler className="h-4 w-4" /> Altura (cm)
                </label>
                <input
                  type="number"
                  required
                  value={formData.height || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, height: Number(e.target.value) })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2">
                  <Activity className="h-4 w-4" /> Nível de Atividade
                </label>
                <select
                  value={formData.activity_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      activity_level: e.target.value as any,
                    })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none dark:text-zinc-100"
                >
                  {Object.entries(ACTIVITY_LEVELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400 flex gap-2">
                  <Target className="h-4 w-4" /> Objetivo
                </label>
                <select
                  value={formData.goal}
                  onChange={(e) =>
                    setFormData({ ...formData, goal: e.target.value as any })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none dark:text-zinc-100"
                >
                  {Object.entries(GOALS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* CHECKBOXES - Agora vão funcionar sem erro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div
                onClick={() =>
                  setFormData({ ...formData, eats_fruit: !formData.eats_fruit })
                }
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.eats_fruit ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"}`}
              >
                <div
                  className={`p-2 rounded-full ${formData.eats_fruit ? "bg-green-100 dark:bg-green-500/20" : "bg-zinc-200 dark:bg-zinc-700"}`}
                >
                  <Apple
                    className={`h-5 w-5 ${formData.eats_fruit ? "text-green-600 dark:text-green-400" : "text-zinc-400"}`}
                  />
                </div>
                <div className="flex-1">
                  <span
                    className={`text-sm font-bold block ${formData.eats_fruit ? "text-green-700 dark:text-green-300" : "text-zinc-500"}`}
                  >
                    Consumo Frutas
                  </span>
                </div>
                {formData.eats_fruit && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>

              <div
                onClick={() =>
                  setFormData({
                    ...formData,
                    body_fat_goal: !formData.body_fat_goal,
                  })
                }
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.body_fat_goal ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"}`}
              >
                <div
                  className={`p-2 rounded-full ${formData.body_fat_goal ? "bg-purple-100 dark:bg-purple-500/20" : "bg-zinc-200 dark:bg-zinc-700"}`}
                >
                  <Target
                    className={`h-5 w-5 ${formData.body_fat_goal ? "text-purple-600 dark:text-purple-400" : "text-zinc-400"}`}
                  />
                </div>
                <div className="flex-1">
                  <span
                    className={`text-sm font-bold block ${formData.body_fat_goal ? "text-purple-700 dark:text-purple-300" : "text-zinc-500"}`}
                  >
                    Focar em % Gordura
                  </span>
                </div>
                {formData.body_fat_goal && (
                  <CheckCircle2 className="h-5 w-5 text-purple-500" />
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <h3 className="text-md font-semibold text-green-600 dark:text-green-500">
                Preferências Alimentares
              </h3>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">
                  Tipo de Dieta
                </label>
                <select
                  value={formData.diet_type || "omnivore"}
                  onChange={(e) =>
                    setFormData({ ...formData, diet_type: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none dark:text-zinc-100"
                >
                  {Object.entries(DIET_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">
                  Alergias (Separar por vírgula)
                </label>
                <input
                  type="text"
                  value={formData.allergies || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, allergies: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">
                  O que você MAIS gosta?
                </label>
                <textarea
                  rows={2}
                  value={formData.food_likes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, food_likes: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 dark:text-white resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500 dark:text-zinc-400">
                  O que você DETESTA?
                </label>
                <textarea
                  rows={2}
                  value={formData.food_dislikes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, food_dislikes: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}{" "}
              Salvar Perfil e Histórico
            </button>
          </form>
        </div>

        {/* COLUNA 2: Gráfico (Direita) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-zinc-800 dark:text-zinc-100 font-semibold mb-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-blue-500" /> Pesagem Rápida
            </h3>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Peso hoje (kg)"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <button
                onClick={handleAddWeight}
                className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg text-white transition-colors"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 h-80 shadow-sm">
            <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-4">
              Evolução do Peso
            </h3>

            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient
                      id="colorWeight"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#3f3f46"
                    vertical={false}
                    opacity={0.1}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(str) => format(new Date(str), "dd/MM")}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    domain={["dataMin - 2", "dataMax + 2"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    labelFormatter={(label) =>
                      format(new Date(label), "dd/MM/yyyy HH:mm")
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorWeight)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm text-center">
                Registre seu peso para ver o gráfico
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
