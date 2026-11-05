import { BrowserRouter, Routes, Route, Navigate, useLocation, type Location } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Register } from './pages/Register';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { DiaryLog } from './pages/DiaryLog';
import { Profile } from './pages/Profile';
import { Recipes } from './pages/Recipes';
import { NewRecipe } from './pages/NewRecipe';
import { AiPlan } from './pages/AiPlain';
import { AiChef } from './pages/AiChef';
import { AppLayout } from './layouts/AppLayout';
import { ShoppingPage } from './pages/ShoppingList';
import { MealPlans } from './pages/MealPlans';
import { MealPlanBuilder } from './pages/MealPlanBuilder';
import { MealPlanDetail } from './pages/MealPlanDetail';
import { Plans } from './pages/Plans';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AlertProvider } from './lib/AlertContext';
import { SubscriptionProvider } from './lib/SubscriptionContext';
import { FeedbackProvider } from './lib/FeedbackContext';
import { FeedbackWidget } from './components/FeedbackWidget';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminRoute } from './components/AdminRoute';
import { AdminOverview } from './pages/AdminOverview';
import { AdminUsers } from './pages/AdminUsers';
import { AdminFinance } from './pages/AdminFinance';
import { AdminUsage } from './pages/AdminUsage';
import { AdminTickets } from './pages/AdminTickets';
import { LEGACY_REDIRECTS, ROUTES } from './routes';
import { LegacyRedirect } from './components/shell/LegacyRedirect';
import { RegistrarOutlet } from './components/shell/RegistrarOutlet';
import { Toaster } from './components/ui/Toast';
import { SplashGate } from './components/brand/Splash';
import { EmBreve } from './components/shell/EmBreve';
import { Politica } from './pages/legal/Politica';
import { Termos } from './pages/legal/Termos';
import { Privacidade } from './pages/perfil/Privacidade';
import { ConsentGate } from './components/consent/ConsentGate';
import './lib/consents';
import { CodigoDeBarras } from './pages/registrar/CodigoDeBarras';
import type { JSX } from 'react';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-bg"><Loader2 className="animate-spin text-act-text h-8 w-8"/></div>;
  }

  // Sem sessão: manda pra home (com o modal de login aberto), não pra uma tela de login.
  return user ? children : <Navigate to="/?login=1" replace />;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={ROUTES.hoje} replace />;
  return <Landing />;
}

function AppRoutes() {
  const location = useLocation();
  // /registrar abre como folha por cima da tela de onde veio; aberto direto (link
  // salvo, recarregar), a tela de fundo é o Hoje.
  const estado = location.state as { background?: Location } | null;
  const naFolha = location.pathname.startsWith(ROUTES.registrar);
  const fundo = estado?.background ?? (naFolha ? { ...location, pathname: ROUTES.hoje, search: "", hash: "" } : undefined);

  return (
    <>
      <Routes location={fundo ?? location}>
        {/* Rotas públicas (sem layout) */}
        <Route path="/" element={<HomeRoute />} />
        {/* Login não tem tela própria: a caixa vem no modal da home. */}
        <Route path="/login" element={<Navigate to="/?login=1" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path={ROUTES.politica} element={<Politica />} />
        <Route path={ROUTES.termos} element={<Termos />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Rotas antigas -> novas (replace; id e query seguem junto) */}
        {LEGACY_REDIRECTS.map(([de, para]) => (
          <Route key={de} path={de} element={<LegacyRedirect to={para} />} />
        ))}

        {/* Rotas privadas: a casca (menu, barra inferior) fica montada entre telas */}
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route path={ROUTES.hoje} element={<Dashboard />} />
          <Route path={ROUTES.diario} element={<DiaryLog />} />
          <Route path={ROUTES.agente} element={<EmBreve titulo="Agente Nuvi" />} />
          <Route path={ROUTES.progresso} element={<EmBreve titulo="Progresso" />} />
          <Route path={ROUTES.perfil} element={<Profile />} />
          <Route path={ROUTES.privacidadePerfil} element={<Privacidade />} />
          <Route path={ROUTES.lembretes} element={<EmBreve titulo="Lembretes" />} />
          <Route path={ROUTES.assinatura} element={<Plans />} />
          <Route path={ROUTES.alimentos} element={<EmBreve titulo="Meus alimentos" />} />
          <Route path={ROUTES.alimentoNovo} element={<EmBreve titulo="Novo alimento" />} />
          <Route path={ROUTES.receitas} element={<Recipes />} />
          <Route path={ROUTES.receitaNova} element={<NewRecipe />} />
          <Route path={ROUTES.comunidade} element={<EmBreve titulo="Comunidade" />} />
          <Route path={ROUTES.chef} element={<AiChef />} />
          <Route path={ROUTES.compras} element={<ShoppingPage />} />
          <Route path={ROUTES.cardapios} element={<MealPlans />} />
          <Route path={ROUTES.cardapioNovo} element={<MealPlanBuilder />} />
          <Route path={ROUTES.cardapioGerar} element={<AiPlan />} />
          <Route path="/cardapios/:id" element={<MealPlanDetail />} />
        </Route>

        {/* Admin — layout totalmente separado do resto do app */}
        <Route path="/admin" element={<PrivateRoute><AdminRoute><AdminLayout><AdminOverview /></AdminLayout></AdminRoute></PrivateRoute>} />
        <Route path="/admin/users" element={<PrivateRoute><AdminRoute><AdminLayout><AdminUsers /></AdminLayout></AdminRoute></PrivateRoute>} />
        <Route path="/admin/finance" element={<PrivateRoute><AdminRoute><AdminLayout><AdminFinance /></AdminLayout></AdminRoute></PrivateRoute>} />
        <Route path="/admin/usage" element={<PrivateRoute><AdminRoute><AdminLayout><AdminUsage /></AdminLayout></AdminRoute></PrivateRoute>} />
        <Route path="/admin/tickets" element={<PrivateRoute><AdminRoute><AdminLayout><AdminTickets /></AdminLayout></AdminRoute></PrivateRoute>} />
      </Routes>

      {naFolha && (
        <Routes>
          <Route path={ROUTES.codigoDeBarras} element={<PrivateRoute><CodigoDeBarras /></PrivateRoute>} />
          <Route path="/registrar/*" element={<PrivateRoute><RegistrarOutlet /></PrivateRoute>} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <FeedbackProvider>
            <BrowserRouter>
              <AppRoutes />
              <SplashGate />
              <Toaster />
              <ConsentGate />
              <FeedbackWidget />
            </BrowserRouter>
          </FeedbackProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </AlertProvider>
  );
}

export default App;
