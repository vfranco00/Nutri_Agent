import politica from "../../legal/politica-de-privacidade.md?raw";
import { Documento } from "./Documento";

export function Politica() {
  return <Documento source={politica} />;
}
