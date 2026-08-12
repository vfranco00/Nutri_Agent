import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  isDiaryApiError,
  type DiaryDay,
  type DiaryTotals,
  type FoodBaseUnit,
  type MealSlot,
} from "../types";

// ============================================================================
// Regras de apresentação do diário alimentar (ADR-0001).
//
// REGRA QUE ATRAVESSA O ARQUIVO INTEIRO (§ 9.3, regra 4): o frontend NÃO soma
// e NÃO arredonda valor nutricional. Todo número exibido sai literal da API.
// As funções abaixo que fazem aritmética produzem *largura de barra* e
// *proporção de fatia* — geometria, nunca um total nutricional novo. Onde a
// geometria não corresponde a um número que a API entregou, o campo de exibição
// vem `null` de propósito, para que a tela não tenha o que inventar.
// ============================================================================

/** Data local em 'YYYY-MM-DD'.
 *  NÃO usar `toISOString().slice(0,10)`: ele devolve a data em UTC e, a partir
 *  das 21h no Brasil (UTC-3), registraria a refeição no dia seguinte. RS-09
 *  fala em data local do usuário. */
export function toIsoDate(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mes}-${dia}`;
}

/** 'YYYY-MM-DD' -> Date no fuso local (parseISO de data pura não desloca). */
export function fromIsoDate(iso: string): Date {
  return parseISO(iso);
}

/** Desloca uma data ISO em N dias, preservando o fuso local. */
export function shiftIsoDate(iso: string, days: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** "Segunda, 11 de agosto" — cabeçalho da Opção 1. */
export function formatDiaryDate(iso: string): string {
  return format(fromIsoDate(iso), "EEEE, d 'de' MMMM", { locale: ptBR });
}

/** Rótulo curto e relativo: "Hoje", "Ontem", "Amanhã" ou a data por extenso. */
export function relativeDayLabel(iso: string, today = toIsoDate(new Date())): string {
  if (iso === today) return "Hoje";
  if (iso === shiftIsoDate(today, -1)) return "Ontem";
  if (iso === shiftIsoDate(today, 1)) return "Amanhã";
  return formatDiaryDate(iso);
}

/** kcal sempre inteiro na tela: o décimo do backend é ruído para o usuário e
 *  a formatação não altera o valor guardado. */
export function formatKcal(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Macro em gramas. `null` é DESCONHECIDO e vira travessão — nunca "0 g"
 *  (§ 9.4: "0 g de proteína" é uma afirmação nutricional; ninguém a fez). */
export function formatGrams(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`;
}

/** Quantidade digitada pelo usuário, sem casa decimal inútil (150 e não 150,0). */
export function formatQuantity(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

const BASE_UNIT_NOUN: Record<FoodBaseUnit, string> = {
  g: "g",
  ml: "ml",
  un: "unidade",
};

/**
 * Densidade energética do alimento, exatamente como a API a expressa: por 1 g,
 * 1 ml ou 1 unidade (§ 4.0).
 *
 * Deliberadamente NÃO multiplica por 100 para mostrar "kcal por 100 g", por
 * mais convencional que seja. O § 4.0 é explícito: a divisão por 100 acontece
 * uma única vez, no seeder do backend, "e nunca mais" — porque "por 100 g" e
 * "por unidade" convivendo é a origem clássica do erro de fator 100 em app de
 * nutrição. Multiplicar de volta na tela reabre exatamente essa porta, e num
 * alimento de `base_unit = "un"` produziria um número sem sentido.
 */
export function formatDensity(kcalPerBaseUnit: number, baseUnit: FoodBaseUnit): string {
  const valor = kcalPerBaseUnit.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${valor} kcal por ${BASE_UNIT_NOUN[baseUnit]}`;
}

// ---------------------------------------------------------------------------
// Barra de energia segmentada (Opção 1)
// ---------------------------------------------------------------------------

export interface EnergySegment {
  slot: MealSlot;
  label: string;
  /** `logged` = bloco sólido; `planned` = bloco hachurado. */
  kind: "logged" | "planned";
  /** Peso relativo para a largura em CSS. Geometria — não é total nutricional. */
  weight: number;
  /** Número da API para escrever dentro do bloco. `null` quando o bloco
   *  representa um resto calculado, que a API nunca entregou como número. */
  displayKcal: number | null;
}

export interface EnergyBar {
  segments: EnergySegment[];
  /** Denominador das larguras. */
  scale: number;
  /** Nenhuma caloria registrada nem planejada: a barra não deve ser desenhada. */
  isEmpty: boolean;
}

/**
 * Um slot rende até dois blocos: o registrado (sólido) e o que ainda falta do
 * planejado (hachurado). O hachurado é `planned - logged` para que um slot com
 * 400 planejadas e 380 registradas não ocupe 780 kcal de barra. Essa subtração
 * existe só como largura: quando ela acontece (há algo registrado no slot), o
 * bloco vai sem número, porque `planned - logged` não é um valor que a API
 * afirmou.
 */
export function buildEnergyBar(day: DiaryDay): EnergyBar {
  const segments: EnergySegment[] = [];

  for (const slot of day.slots) {
    if (slot.logged_calories > 0) {
      segments.push({
        slot: slot.slot,
        label: slot.label,
        kind: "logged",
        weight: slot.logged_calories,
        displayKcal: slot.logged_calories,
      });
    }
    const restante = slot.planned_calories - slot.logged_calories;
    if (restante > 0) {
      segments.push({
        slot: slot.slot,
        label: slot.label,
        kind: "planned",
        weight: restante,
        displayKcal: slot.logged_calories > 0 ? null : slot.planned_calories,
      });
    }
  }

  const somaDosBlocos = segments.reduce((acc, s) => acc + s.weight, 0);
  const meta = day.calories_target ?? 0;
  // A meta é o denominador enquanto couber; estourando, a própria barra vira a
  // referência para nada transbordar do trilho.
  const scale = Math.max(meta, somaDosBlocos);

  return { segments, scale, isEmpty: segments.length === 0 || scale <= 0 };
}

/** Largura em porcentagem de um bloco. Retorna string pronta para o style. */
export function segmentWidth(weight: number, scale: number): string {
  if (scale <= 0) return "0%";
  return `${(weight / scale) * 100}%`;
}

/**
 * Equivalente textual da barra (a11y: a informação não pode existir só em cor
 * e largura). Cita apenas números que a API entregou.
 */
export function describeEnergyBar(day: DiaryDay): string {
  const partes = day.slots
    .filter((s) => s.logged_calories > 0 || s.planned_calories > 0)
    .map((s) => {
      const trechos: string[] = [];
      if (s.logged_calories > 0) trechos.push(`${formatKcal(s.logged_calories)} kcal registradas`);
      if (s.planned_calories > 0) trechos.push(`${formatKcal(s.planned_calories)} kcal planejadas`);
      return `${s.label}: ${trechos.join(", ")}`;
    });

  if (partes.length === 0) return "Nenhuma caloria registrada ou planejada neste dia.";

  const meta =
    day.calories_target !== null
      ? ` Meta do dia: ${formatKcal(day.calories_target)} kcal.`
      : " Sem meta calórica definida no perfil.";

  return `Energia do dia por refeição. ${partes.join(". ")}.${meta}`;
}

// ---------------------------------------------------------------------------
// Donut de macros (card trazido da Opção 2)
// ---------------------------------------------------------------------------

export type MacroKey = "protein" | "carbs" | "fat";

export interface MacroSlice {
  key: MacroKey;
  label: string;
  grams: number;
  /** Fatia do donut, em 0–100. Proporção EM GRAMAS entre os três macros. */
  percent: number;
  /** Deslocamento acumulado do arco anterior, já negativo (stroke-dashoffset). */
  offset: number;
}

export interface MacroDonut {
  slices: MacroSlice[];
  /** Nenhum dos três macros conhecido: o card entra em estado vazio. */
  isEmpty: boolean;
}

const MACRO_LABELS: Record<MacroKey, string> = {
  protein: "Proteína",
  carbs: "Carboidrato",
  fat: "Gordura",
};

/**
 * Proporção **em gramas**, deliberadamente. Converter macro em caloria exigiria
 * aplicar 4/4/9 kcal/g no cliente — inventar aritmética nutricional que o
 * backend não fez e que o § 9.3 concentra num módulo só. Macro `null` é
 * desconhecido: fica fora do donut em vez de virar fatia zero.
 */
export function buildMacroDonut(totals: DiaryTotals): MacroDonut {
  const candidatos: { key: MacroKey; grams: number }[] = [
    { key: "protein", grams: totals.protein_g ?? 0 },
    { key: "carbs", grams: totals.carbs_g ?? 0 },
    { key: "fat", grams: totals.fat_g ?? 0 },
  ];
  const brutos = candidatos.filter((m) => m.grams > 0);

  const soma = brutos.reduce((acc, m) => acc + m.grams, 0);
  if (soma <= 0) return { slices: [], isEmpty: true };

  let acumulado = 0;
  const slices = brutos.map((m) => {
    const percent = (m.grams / soma) * 100;
    const slice: MacroSlice = {
      key: m.key,
      label: MACRO_LABELS[m.key],
      grams: m.grams,
      percent,
      offset: -acumulado,
    };
    acumulado += percent;
    return slice;
  });

  return { slices, isEmpty: false };
}

/** Equivalente textual do donut (a11y). */
export function describeMacroDonut(totals: DiaryTotals, macrosIncomplete: boolean): string {
  const donut = buildMacroDonut(totals);
  if (donut.isEmpty) return "Nenhum macronutriente informado para este dia.";

  const partes = donut.slices.map(
    (s) => `${s.label}: ${formatGrams(s.grams)}, ${Math.round(s.percent)}% do total em gramas`,
  );
  const ressalva = macrosIncomplete
    ? " Alguns alimentos do dia não informam macros, então a proporção é parcial."
    : "";

  return `Distribuição de macronutrientes. ${partes.join(". ")}.${ressalva}`;
}

// ---------------------------------------------------------------------------
// Estado do dia
// ---------------------------------------------------------------------------

/**
 * Quanto ainda cabe na meta. É uma DIFERENÇA entre dois valores que a API já
 * entregou prontos, não uma soma de entradas: não há como divergir do total do
 * servidor. A API não expõe esse campo e o card "Ainda cabem N kcal" precisa
 * dele. `null` quando o perfil não tem meta.
 */
export function remainingCalories(day: DiaryDay): number | null {
  if (day.calories_target === null) return null;
  // Reduz o ruído de ponto flutuante da subtração (2100 - 1487.3), sem alterar
  // nenhum valor nutricional: o resultado é exibido com 0 casa de qualquer modo.
  return Math.round((day.calories_target - day.totals.calories) * 10) / 10;
}

/** Usuário novo: nada registrado e nada planejado. Dispara o vazio convidativo. */
export function isDayEmpty(day: DiaryDay): boolean {
  return day.entries_count === 0 && day.planned_totals.calories <= 0;
}

/** Toda entrada do dia, achatada e já na ordem canônica dos slots. */
export function allEntries(day: DiaryDay) {
  return day.slots.flatMap((s) => s.entries);
}

// ---------------------------------------------------------------------------
// Card "Próximo passo"
// ---------------------------------------------------------------------------

export type NextStepId = "registrar-refeicao" | "vincular-cardapio" | "registrar-peso" | "completar-perfil";

export interface NextStep {
  id: NextStepId;
  title: string;
  hint: string;
  path: string;
}

export interface NextStepInput {
  day: DiaryDay | null;
  /** `profiles.daily_calories` do usuário; `null`/`undefined` = perfil incompleto. */
  hasCalorieTarget: boolean;
  hasWeightHistory: boolean;
}

/**
 * O que sugerir agora, em ordem de urgência. Regra de negócio pura para poder
 * ser testada sem montar a tela: cada item só entra se o dado que ele resolve
 * estiver mesmo faltando — sugerir "registre seu peso" a quem pesou ontem é
 * ruído, não ajuda.
 */
export function buildNextSteps({ day, hasCalorieTarget, hasWeightHistory }: NextStepInput): NextStep[] {
  const passos: NextStep[] = [];

  if (!hasCalorieTarget) {
    passos.push({
      id: "completar-perfil",
      title: "Definir sua meta de calorias",
      hint: "Sem ela, o diário não sabe quanto ainda cabe no dia",
      path: "/profile",
    });
  }

  if (day !== null && day.entries_count === 0) {
    passos.push({
      id: "registrar-refeicao",
      title: "Registrar a primeira refeição",
      hint: "Leva menos de um minuto",
      path: "/diario",
    });
  }

  if (day !== null && day.meal_plan === null) {
    passos.push({
      id: "vincular-cardapio",
      title: "Colocar um cardápio no calendário",
      hint: "É o que desenha a parte planejada da barra",
      path: "/meal-plans",
    });
  }

  if (!hasWeightHistory) {
    passos.push({
      id: "registrar-peso",
      title: "Registrar o seu peso",
      hint: "A evolução começa na primeira pesagem",
      path: "/profile",
    });
  }

  return passos;
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

interface AxiosLikeError {
  response?: { status?: number; data?: { detail?: unknown } };
}

/**
 * Mensagem exibível a partir de um erro da API do diário.
 *
 * § 6.0: `detail` é OBJETO com `code` em erro de negócio e ARRAY no 422.
 * RS-12: o 422 não traz mais `input` — e este código nunca o lê. Do array só
 * sai `msg`, que é texto de validação e não repete o alimento enviado (RS-27).
 */
export function extractDiaryErrorMessage(err: unknown, fallback: string): string {
  const erro = err as AxiosLikeError | undefined;
  const status = erro?.response?.status;

  if (status === 429) {
    return "Muitas tentativas em pouco tempo. Espere alguns segundos e tente de novo.";
  }

  const detail = erro?.response?.data?.detail;

  if (isDiaryApiError(detail)) {
    switch (detail.code) {
      case "FOOD_NOT_FOUND":
      case "FOOD_NOT_RESOLVED":
        return "Não encontramos esse alimento. Tente outro nome.";
      case "FOOD_RESOLVER_UNAVAILABLE":
        return "A estimativa por IA está indisponível agora. Tente de novo em alguns minutos.";
      case "ENTRY_NOT_FOUND":
        return "Essa entrada não existe mais. Atualize o dia.";
      case "PLAN_LIMIT_REACHED":
        return detail.message || "Você atingiu o limite de registros para este dia.";
      case "UNIT_NOT_SUPPORTED_FOR_FOOD":
        return "Essa unidade não vale para este alimento. Escolha outra na lista.";
      default:
        return detail.message || fallback;
    }
  }

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    // Só `msg`. Nunca `input` (RS-12), nunca `loc` renderizado cru.
    const primeiro = detail[0] as { msg?: string } | undefined;
    return primeiro?.msg || fallback;
  }

  return fallback;
}

/** `true` quando o erro é o teto de 60 entradas/dia do RS-11. */
export function isDailyEntryLimit(err: unknown): boolean {
  const detail = (err as AxiosLikeError | undefined)?.response?.data?.detail;
  return isDiaryApiError(detail) && detail.code === "PLAN_LIMIT_REACHED";
}
