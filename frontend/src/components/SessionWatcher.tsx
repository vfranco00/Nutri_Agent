import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { api } from "../lib/api";
import { getTokenExpiry } from "../lib/jwt";
import { useAuth } from "../lib/AuthContext";

const WARNING_THRESHOLD_MS = 2 * 60 * 1000; // avisa faltando 2 minutos
const CHECK_INTERVAL_MS = 15 * 1000;

export function SessionWatcher() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  // Timestamp absoluto de expiração — só é setado quando entra na janela de aviso.
  const [expiryTs, setExpiryTs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const loggedOutRef = useRef(false);

  useEffect(() => {
    function check() {
      const token = localStorage.getItem("nutri_token");
      if (!token) return;
      const expiry = getTokenExpiry(token);
      if (!expiry) return;
      if (expiry - Date.now() <= WARNING_THRESHOLD_MS) {
        setExpiryTs(expiry);
      }
    }
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (expiryTs === null) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiryTs && !loggedOutRef.current) {
        loggedOutRef.current = true;
        logout();
        navigate("/?login=1");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiryTs, logout, navigate]);

  if (expiryTs === null) return null;

  const secondsLeft = Math.max(0, Math.ceil((expiryTs - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  async function handleExtend() {
    setRefreshing(true);
    try {
      const res = await api.post("/auth/refresh");
      localStorage.setItem("nutri_token", res.data.access_token);
      setExpiryTs(null);
    } catch (error) {
      console.error(error);
      logout();
      navigate("/?login=1");
    } finally {
      setRefreshing(false);
    }
  }

  function handleLogoutNow() {
    logout();
    navigate("/?login=1");
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-orange-600 dark:text-orange-500" />
        </div>
        <h2 className="text-lg font-bold dark:text-white mb-1">
          Sua sessão está expirando
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
          Você será desconectado em{" "}
          <strong className="text-orange-600 dark:text-orange-500">
            {minutes}:{String(seconds).padStart(2, "0")}
          </strong>
          .
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleExtend}
            disabled={refreshing}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Continuar conectado
          </button>
          <button
            onClick={handleLogoutNow}
            className="w-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair agora
          </button>
        </div>
      </div>
    </div>
  );
}
