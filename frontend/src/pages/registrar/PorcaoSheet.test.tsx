import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PorcaoSheet } from "./PorcaoSheet";
import type { FoodOption } from "../../types";

const base: FoodOption = {
  food_ref: "cache:7",
  name: "Energético Mango Loco",
  base_unit: "ml",
  kcal_per_base_unit: 0.5,
  protein_per_base_unit: null,
  carbs_per_base_unit: 0.13,
  fat_per_base_unit: null,
  allowed_units: ["ml", "colher_sopa", "colher_cha", "xicara"],
  source: "openfoodfacts",
  is_estimate: true,
  portions: [
    { label: "Porção", quantity: 200 },
    { label: "Lata", quantity: 473 },
  ],
};

function abrir(food: FoodOption) {
  render(
    <MemoryRouter>
      <PorcaoSheet food={food} destino="Café · Hoje" onClose={vi.fn()} onAdd={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("PorcaoSheet", () => {
  it("líquido: ml, 'por 100 ml' e a lata como atalho já escolhida", () => {
    abrir(base);
    expect(screen.getByText("Valores por 100 ml")).toBeTruthy();
    expect((screen.getByLabelText("Unidade") as HTMLSelectElement).value).toBe("ml");
    expect(screen.getByLabelText("Quantidade").textContent).toBe("473");
    expect(screen.getByRole("button", { name: "Lata 473 ml" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Porção 200 ml" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "250 ml" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "350 ml" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "50 g" })).toBeNull();
    // 473 ml x 0,5 kcal/ml e carbo 0,13 g/ml
    expect(screen.getByText("237")).toBeTruthy();
    expect(screen.getByText("61,5 g")).toBeTruthy();
  });

  it("tocar em 250 ml muda a quantidade", async () => {
    abrir(base);
    await userEvent.click(screen.getByRole("button", { name: "250 ml" }));
    expect(screen.getByLabelText("Quantidade").textContent).toBe("250");
  });

  it("sólido continua em g, por 100 g, com atalhos em g", () => {
    abrir({ ...base, name: "Biscoito", base_unit: "g", allowed_units: ["g", "colher_sopa"], portions: [] });
    expect(screen.getByText("Valores por 100 g")).toBeTruthy();
    expect((screen.getByLabelText("Unidade") as HTMLSelectElement).value).toBe("g");
    expect(screen.getByLabelText("Quantidade").textContent).toBe("100");
    expect(screen.getByRole("button", { name: "50 g" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "250 ml" })).toBeNull();
  });
});
