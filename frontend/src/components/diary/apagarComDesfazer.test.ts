import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/registro", () => ({
  apagarEntrada: vi.fn(),
  recriarEntrada: vi.fn(),
  mensagemDeErro: (_e: unknown, f: string) => f,
}));
vi.mock("../ui/toastStore", () => ({ toast: vi.fn() }));

import { apagarEntrada, recriarEntrada } from "../../lib/registro";
import { toast } from "../ui/toastStore";
import { apagarComDesfazer } from "./apagarComDesfazer";
import type { DiaryEntry } from "../../types";

const entrada = (id: number) => ({ id, food_name: "arroz" }) as unknown as DiaryEntry;

beforeEach(() => {
  vi.mocked(apagarEntrada).mockReset().mockResolvedValue({} as never);
  vi.mocked(recriarEntrada).mockReset().mockResolvedValue({} as never);
  vi.mocked(toast).mockReset();
});

describe("apagarComDesfazer", () => {
  it("apagar repetido da mesma entrada dispara um único DELETE", async () => {
    const e = entrada(10);
    await Promise.all([apagarComDesfazer(e), apagarComDesfazer(e)]);
    await apagarComDesfazer(e);
    expect(apagarEntrada).toHaveBeenCalledTimes(1);
  });

  it("cliques repetidos em Desfazer recriam a entrada uma única vez", async () => {
    await apagarComDesfazer(entrada(11));
    const acao = vi.mocked(toast).mock.calls[0][1]!.action!;
    acao.onClick();
    acao.onClick();
    acao.onClick();
    expect(recriarEntrada).toHaveBeenCalledTimes(1);
  });

  it("se o apagar falhar, dá para tentar de novo", async () => {
    vi.mocked(apagarEntrada).mockRejectedValueOnce(new Error("x"));
    const e = entrada(12);
    await apagarComDesfazer(e);
    await apagarComDesfazer(e);
    expect(apagarEntrada).toHaveBeenCalledTimes(2);
  });
});
