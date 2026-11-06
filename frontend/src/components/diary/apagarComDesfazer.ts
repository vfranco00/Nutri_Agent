import { toast } from "../ui/toastStore";
import { apagarEntrada, mensagemDeErro, recriarEntrada } from "../../lib/registro";
import type { DiaryEntry } from "../../types";

// Entradas já enviadas para apagar: cliques repetidos viram no-op (senão sai DELETE em série e 404).
const emApagar = new Set<number>();

/** Arrastar para apagar: apaga já e oferece "Desfazer" (recria pelo food_ref, quantidade e unidade). */
export async function apagarComDesfazer(e: DiaryEntry): Promise<void> {
  if (emApagar.has(e.id)) return;
  emApagar.add(e.id);
  try {
    await apagarEntrada(e.id);
  } catch (err) {
    emApagar.delete(e.id);
    toast(mensagemDeErro(err, "Não foi possível apagar."));
    return;
  }
  let desfeito = false;
  toast(`${e.food_name} apagado`, {
    action: {
      label: "Desfazer",
      onClick: () => {
        if (desfeito) return;
        desfeito = true;
        void recriarEntrada(e).catch((err) => {
          desfeito = false;
          toast(mensagemDeErro(err, "Não foi possível desfazer."));
        });
      },
    },
  });
}
