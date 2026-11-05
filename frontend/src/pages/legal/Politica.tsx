import politica from "../../legal/politica.md?raw";
import { Documento } from "./Documento";

export function Politica() {
  return <Documento source={politica} />;
}
