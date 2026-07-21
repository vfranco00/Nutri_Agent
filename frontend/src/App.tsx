import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Recipes } from './pages/Recipes';
import { NewRecipe } from './pages/NewRecipe';
// import { Admin } from './pages/AdminUsers';
import { AiPlan } from './pages/AiPlain';
import { AiChef } from './pages/AiChef';
import { AppLayout } from './layouts/AppLayout';
import { ShoppingPage } from './pages/ShoppingList';
import { MealPlans } from './pages/MealPlans';
import { MealPlanBuilder } from './pages/MealPlanBuilder';
import { MealPlanDetail } from './pages/MealPlanDetail';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AlertProvider } from './lib/AlertContext';
import type { JSX } from 'react';
import { Admin } from './pages/Admin'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-950"><Loader2 className="animate-spin text-green-500 h-8 w-8"/></div>;
  }
  
  return user ? children : <Navigate to="/login" />;
}

const LayoutRoute = ({ children, color }: { children: React.ReactNode, color?: string }) => (
  <AppLayout accentColor={color}>{children}</AppLayout>
);

function AppRoutes() {
  return(
    <Routes>
          {/* Rotas Públicas (Sem Layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

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

          {/* Admin = Vermelho */}
          <Route path="/admin" element={<PrivateRoute><LayoutRoute color="text-red-500"><Admin /></LayoutRoute></PrivateRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
  )
}

function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </AlertProvider>
  );
}

export default App;