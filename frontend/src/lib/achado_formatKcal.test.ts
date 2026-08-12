/**
 * Achado A-08 do relatório `docs/qa/relatorio-diario.md`.
 *
 * `formatKcal` (`src/lib/diary.ts:59-61`) arredonda para inteiro na exibição
 * (`maximumFractionDigits: 0`). O § 9.3 do ADR-0001 escolhe deliberadamente "o total que
 * fecha com o que está escrito" — somar os valores JÁ arredondados das entradas, em vez
 * de somar cru, justamente para que o usuário que confira na calculadora encontre o mesmo
 * número. Arredondar de novo na tela reintroduz a divergência um nível abaixo: o backend
 * entrega números que fecham, e a tela mostra números que não fecham.
 *
 * Este teste NÃO propõe que a tela mostre décimos; ele só demonstra que a garantia do
 * § 9.3 não sobrevive à formatação atual. A correção é uma decisão de produto (mostrar a
 * casa decimal, ou fazer o backend arredondar para inteiro nas duas pontas).
 */

import { describe, it, expect } from "vitest";
import { formatKcal } from "./diary";

describe("formatKcal — a soma do que está escrito", () => {
  // `it.fails`: a divergência é CONHECIDA e ainda não foi decidida (ver A-08). O teste
  // passa enquanto o defeito existir e fica VERMELHO no dia em que alguém o corrigir,
  // forçando apagar este arquivo em vez de deixá-lo mentindo. É o oposto de `skip`, que
  // esconderia o problema.
  it.fails("os blocos exibidos somam o total exibido", () => {
    // Números que o backend produz e persiste com 1 casa decimal.
    const cafe = 100.5;
    const almoco = 200.5;
    const totalDoServidor = 301.0; // round(100.5 + 200.5, 1)

    const exibidos = [cafe, almoco].map((v) => Number(formatKcal(v).replace(/\./g, "")));
    const somaDoQueEstaEscrito = exibidos.reduce((a, b) => a + b, 0);

    expect(somaDoQueEstaEscrito).toBe(
      Number(formatKcal(totalDoServidor).replace(/\./g, "")),
    );
  });
});
