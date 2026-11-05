import { Navigate, useLocation, useParams } from "react-router-dom";

/** Redireciona uma rota antiga para a nova, com `replace`, preservando `:id`, query e hash. */
export function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const destino = to.replace(/:(\w+)/g, (_, nome: string) => encodeURIComponent(params[nome] ?? ""));
  return <Navigate to={`${destino}${search}${hash}`} replace />;
}
