import termos from "../../legal/termos.md?raw";
import { Documento } from "./Documento";

export function Termos() {
  return <Documento source={termos} />;
}
