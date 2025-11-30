import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Recipes } from './pages/Recipes';
import { NewRecipe } from './pages/NewRecipe';
import { AdminUsers } from './pages/AdminUsers';
import { AiPlan } from './pages/AiPlain';
import { AiChef } from './pages/AiChef';
import { AppLayout } from './layouts/AppLayout';

const LayoutRoute = ({ children, color }: { children: React.ReactNode, color?: string }) => (
  <AppLayout accentColor={color}>{children}</AppLayout>
);

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <BrowserRouter>
        <Routes>
          {/* Rotas Públicas (Sem Layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rotas Privadas (Com Layout e Sidebar) */}
          <Route path="/dashboard" element={<LayoutRoute color="text-zinc-500"><Dashboard /></LayoutRoute>} />

          {/* Perfil = Verde */}
          <Route path="/profile" element={<LayoutRoute color="text-green-500"><Profile /></LayoutRoute>} />

          {/* Receitas = Laranja */}
          <Route path="/recipes" element={<LayoutRoute color="text-orange-500"><Recipes /></LayoutRoute>} />
          <Route path="/recipes/new" element={<LayoutRoute color="text-orange-500"><NewRecipe /></LayoutRoute>} />

          {/* IA = Roxo/Azul */}
          <Route path="/ai-plan" element={<LayoutRoute color="text-purple-500"><AiPlan /></LayoutRoute>} />
          <Route path="/ai-chef" element={<LayoutRoute color="text-blue-500"><AiChef /></LayoutRoute>} />

          {/* Admin = Vermelho */}
          <Route path="/admin" element={<LayoutRoute color="text-red-500"><AdminUsers /></LayoutRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;