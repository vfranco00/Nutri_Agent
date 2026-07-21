export const NUTRITION_TIPS: string[] = [
  "Beba água antes das refeições — ajuda na saciedade e na digestão.",
  "Priorize alimentos in natura em vez de ultraprocessados sempre que possível.",
  "Mastigar devagar ajuda o cérebro a perceber a saciedade com mais precisão.",
  "Frutas inteiras saciam mais que sucos, por causa das fibras.",
  "Distribuir proteína ao longo do dia ajuda na manutenção da massa muscular.",
  "Um bom café da manhã evita exageros nas próximas refeições.",
  "Fibras (verduras, legumes, grãos integrais) ajudam a controlar a fome.",
  "Dormir mal aumenta a vontade de comer doces e ultraprocessados no dia seguinte.",
  "Gorduras boas (azeite, castanhas, abacate) fazem parte de uma dieta equilibrada.",
  "Planejar as refeições da semana reduz decisões por impulso na hora da fome.",
  "Temperos naturais (ervas, limão, alho) ajudam a reduzir o excesso de sal.",
  "Congelar porções de comida caseira é uma forma prática de comer melhor com pouco tempo.",
  "Comer sem telas ajuda a perceber melhor os sinais de fome e saciedade.",
  "Variedade de cores no prato geralmente indica variedade de nutrientes.",
  "Atividade física regular potencializa os resultados de uma boa alimentação.",
];

export function getRandomTip(exclude?: string): string {
  const pool = exclude
    ? NUTRITION_TIPS.filter((t) => t !== exclude)
    : NUTRITION_TIPS;
  return pool[Math.floor(Math.random() * pool.length)];
}
