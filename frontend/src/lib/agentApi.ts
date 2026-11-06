import { api } from "./api";
import type { AgentParseRequest, AgentParseResponse } from "../types";

export async function parseAgente(body: AgentParseRequest): Promise<AgentParseResponse> {
  const { data } = await api.post<AgentParseResponse>("/agent/parse", body);
  return data;
}

/** Reduz a foto para no máximo `maxLado` px no maior lado e devolve um data URL JPEG (0,85). */
export function reduzirImagem(file: File, maxLado = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas indisponível"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem inválida"));
    };
    img.src = url;
  });
}
