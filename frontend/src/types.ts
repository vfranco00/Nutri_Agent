// Define o formato do Perfil (igual ao Pydantic do Back)
export interface Profile {
  id?: number;
  user_id?: number;
  age: number;
  weight: number;
  height: number;
  gender: 'male' | 'female';
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'super_active';
  goal: 'lose_weight' | 'maintain' | 'gain_muscle';
  diet_type?: string;
  allergies?: string;
  food_likes?: string;
  food_dislikes?: string;
}

export const DIET_TYPES = {
  omnivore: 'Onívoro (Sem restrições)',
  flexitarian: 'Flexitariano (Reduz carne)',
  pescatarian: 'Pescetariano (Peixe sim, carne não)',
  vegetarian_ovo_lacto: 'Vegetariano (Ovo-Lacto)',
  vegetarian_lacto: 'Vegetariano (Lacto)',
  vegetarian_ovo: 'Vegetariano (Ovo)',
  vegan: 'Vegano (Nada animal)',
  paleo: 'Paleolítica',
  keto: 'Cetogênica',
  low_carb: 'Low Carb',
};

// Labels amigáveis para mostrar no select
export const ACTIVITY_LEVELS = {
  sedentary: 'Sedentário (Pouco ou nenhum exercício)',
  lightly_active: 'Levemente Ativo (1-3 dias/semana)',
  moderately_active: 'Moderadamente Ativo (3-5 dias/semana)',
  very_active: 'Muito Ativo (6-7 dias/semana)',
  super_active: 'Super Ativo (Trabalho físico pesado/Treino 2x dia)',
};

export const GOALS = {
  lose_weight: 'Perder Peso',
  maintain: 'Manter Peso',
  gain_muscle: 'Ganhar Massa Muscular',
};

export interface Recipe {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  instructions: string;
  prep_time?: number;
  calories?: number;
  preparation_method?: string;
  category?: string;
  is_favorite?: boolean;
  ingredients?: Ingredient[];
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_superuser: boolean;
  is_active: boolean;
}

export interface Meal {
  name: string;
  suggestion: string;
}

export interface AiPlan {
  calories_target: number;
  macros: {
    protein: string;
    carbs: string;
    fats: string;
  };
  meals: Meal[];
  tip: string;
}

export interface ShoppingItem {
  id: number;
  name: string;
  checked: boolean;
}

export interface ShoppingList {
  id: number;
  title: string;
  created_at: string;
  items: ShoppingItem[];
}

export interface DailyPlan {
  day: string;
  calories_target: number;
  macros: {
    protein: string;
    carbs: string;
    fats: string;
  };
  meals: Meal[];
  tip: string;
}

export interface AiPlanResponse {
  days: DailyPlan[];
}

export interface Ingredient {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  calories?: number; // <--- Novo
}

export const CATEGORIES = {
  all: 'Todas',
  almoco: 'Almoço',
  jantar: 'Jantar',
  lanche: 'Lanche',
  doce: 'Doce',
  salgado: 'Salgado'
};