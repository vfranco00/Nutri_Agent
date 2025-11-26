import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';

// Componentes temporários (logo vamos criar arquivos pra eles)
const Register = () => <div className="p-10 text-white">Tela de Cadastro 📝</div>;
const Dashboard = () => <div className="p-10 text-green-400">Dashboard (Área Protegida) 🍎</div>;

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;