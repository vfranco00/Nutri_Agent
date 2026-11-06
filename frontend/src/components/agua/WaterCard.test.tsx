import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WaterCard } from "./WaterCard";
import { Toaster } from "../ui/Toast";
import { __limparToasts } from "../ui/toastStore";
import { api } from "../../lib/api";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const dia = (total: number, ids: number[] = []) => ({
  data: { date: "2026-11-06", goal_ml: 2450, total_ml: total, entries: ids.map((id) => ({ id, ml: 250, created_at: "" })) },
});

beforeEach(() => {
  __limparToasts();
  vi.mocked(api.get).mockResolvedValue(dia(500));
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
});

describe("WaterCard", () => {
  it("mostra total e meta", async () => {
    render(<WaterCard date="2026-11-06" />);
    expect(await screen.findByText("500 de 2450 ml")).toBeInTheDocument();
  });

  it("+250 ml chama o POST e desfazer chama o DELETE", async () => {
    vi.mocked(api.post).mockResolvedValue(dia(750, [41]));
    vi.mocked(api.delete).mockResolvedValue(dia(500));
    render(
      <>
        <WaterCard date="2026-11-06" />
        <Toaster />
      </>,
    );
    await screen.findByText("500 de 2450 ml");
    await userEvent.click(screen.getByRole("button", { name: "+250 ml" }));
    expect(api.post).toHaveBeenCalledWith("/water", { date: "2026-11-06", ml: 250 });
    expect(await screen.findByText("750 de 2450 ml")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(api.delete).toHaveBeenCalledWith("/water/41");
    expect(await screen.findByText("500 de 2450 ml")).toBeInTheDocument();
  });
});
