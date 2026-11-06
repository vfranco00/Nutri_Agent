import termos from "../../legal/termos-de-uso.md?raw";
import { Documento } from "./Documento";

export function Termos() {
  return <Documento source={termos} />;
}
