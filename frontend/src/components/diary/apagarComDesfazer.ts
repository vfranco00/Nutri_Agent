import { toast } from "../ui/toastStore";
import { apagarEntrada, mensagemDeErro, recriarEntrada } from "../../lib/registro";
import type { DiaryEntry } from "../../types";

/** Arrastar para apagar: apaga já e oferece "Desfazer" (recria pelo food_ref, quantidade e unidade). */
export async function apagarComDesfazer(e: DiaryEntry): Promise<void> {
  try {
    await apagarEntrada(e.id);
  } catch (err) {
    toast(mensagemDeErro(err, "Não foi possível apagar."));
    return;
  }
  toast(`${e.food_name} apagado`, {
    action: {
      label: "Desfazer",
      onClick: () => void recriarEntrada(e).catch((err) => toast(mensagemDeErro(err, "Não foi possível desfazer."))),
    },
  });
}
