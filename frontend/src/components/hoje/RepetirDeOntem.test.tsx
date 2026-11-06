import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RepetirDeOntem } from "./RepetirDeOntem";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../lib/api", () => ({ api }));

const dia = (n: number) => ({ date: "2026-11-05", slots: [{ slot: "cafe_da_manha", entries: Array.from({ length: n }, (_, i) => ({ id: i })) }] });

describe("RepetirDeOntem", () => {
  it("aparece quando ontem tem a refeição e copia só aquele slot", async () => {
    api.get.mockResolvedValue({ data: dia(2) });
    api.post.mockResolvedValue({ data: dia(2) });
    render(<RepetirDeOntem date="2026-11-06" slot="cafe_da_manha" />);
    await userEvent.click(await screen.findByRole("button", { name: "Repetir de ontem" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/diary/copy", { from_date: "2026-11-05", to_date: "2026-11-06", meal_slot: "cafe_da_manha" }));
  });

  it("some quando ontem estava vazio", async () => {
    api.get.mockReset();
    api.get.mockResolvedValue({ data: dia(0) });
    render(<RepetirDeOntem date="2026-12-06" slot="cafe_da_manha" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Repetir de ontem" })).toBeNull();
  });
});
