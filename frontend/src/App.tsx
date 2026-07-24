import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
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
import type { JSX } from 'react';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-950"><Loader2 className="animate-spin text-green-500 h-8 w-8"/></div>;
  }

  // Sem sessão: manda pra home (com o modal de login aberto), não pra uma tela de login.
  return user ? children : <Navigate to="/?login=1" replace />;
}

const LayoutRoute = ({ children, color }: { children: React.ReactNode, color?: string }) => (
  <AppLayout accentColor={color}>{children}</AppLayout>
);

function AppRoutes() {
  return(
    <Routes>
          {/* Rotas Públicas (Sem Layout) */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rotas Privadas (Com Layout e Sidebar) */}
          <Route path="/dashboard" element={<PrivateRoute><LayoutRoute color="text-zinc-500"><Dashboard /></LayoutRoute></PrivateRoute>} />

          {/* Perfil = Verde */}
          <Route path="/profile" element={<PrivateRoute><LayoutRoute color="text-green-500"><Profile /></LayoutRoute></PrivateRoute>} />

          {/* Receitas = Laranja */}
          <Route path="/recipes" element={<PrivateRoute><LayoutRoute color="text-orange-500"><Recipes /></LayoutRoute></PrivateRoute>} />
          <Route path="/recipes/new" element={<PrivateRoute><LayoutRoute color="text-orange-500"><NewRecipe /></LayoutRoute></PrivateRoute>} />

          {/* IA = Roxo/Azul */}
          <Route path="/ai-plan" element={<PrivateRoute><LayoutRoute color="text-purple-500"><AiPlan /></LayoutRoute></PrivateRoute>} />
          <Route path="/ai-chef" element={<PrivateRoute><LayoutRoute color="text-blue-500"><AiChef /></LayoutRoute></PrivateRoute>} />

          {/* Lista de Compras = Rosa */}
          <Route path="/shopping" element={<PrivateRoute><LayoutRoute color="text-pink-500"><ShoppingPage /></LayoutRoute></PrivateRoute>} />

          {/* Planos Alimentares = Teal */}
          <Route path="/meal-plans" element={<PrivateRoute><LayoutRoute color="text-teal-500"><MealPlans /></LayoutRoute></PrivateRoute>} />
          <Route path="/meal-plans/new" element={<PrivateRoute><LayoutRoute color="text-teal-500"><MealPlanBuilder /></LayoutRoute></PrivateRoute>} />
          <Route path="/meal-plans/:id" element={<PrivateRoute><LayoutRoute color="text-teal-500"><MealPlanDetail /></LayoutRoute></PrivateRoute>} />

          {/* Planos = Âmbar */}
          <Route path="/planos" element={<PrivateRoute><LayoutRoute color="text-amber-500"><Plans /></LayoutRoute></PrivateRoute>} />

          {/* Admin — layout totalmente separado do resto do app */}
          <Route path="/admin" element={<PrivateRoute><AdminRoute><AdminLayout><AdminOverview /></AdminLayout></AdminRoute></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><AdminRoute><AdminLayout><AdminUsers /></AdminLayout></AdminRoute></PrivateRoute>} />
          <Route path="/admin/finance" element={<PrivateRoute><AdminRoute><AdminLayout><AdminFinance /></AdminLayout></AdminRoute></PrivateRoute>} />
          <Route path="/admin/usage" element={<PrivateRoute><AdminRoute><AdminLayout><AdminUsage /></AdminLayout></AdminRoute></PrivateRoute>} />
          <Route path="/admin/tickets" element={<PrivateRoute><AdminRoute><AdminLayout><AdminTickets /></AdminLayout></AdminRoute></PrivateRoute>} />

        </Routes>
  )
}

function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <FeedbackProvider>
            <BrowserRouter>
              <AppRoutes />
              <FeedbackWidget />
            </BrowserRouter>
          </FeedbackProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </AlertProvider>
  );
}

export default App;
