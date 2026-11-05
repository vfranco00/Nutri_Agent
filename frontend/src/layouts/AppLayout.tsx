import { Outlet } from "react-router-dom";
import { AppShell } from "../components/shell/AppShell";

/** Layout das rotas privadas: a casca fica montada ao navegar entre telas. */
export function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
