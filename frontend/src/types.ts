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
}

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