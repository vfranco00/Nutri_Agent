import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function checkUser() {
    const token = localStorage.getItem('nutri_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Tenta buscar o usuário com o token salvo
      const res = await api.get('/users/me');
      setUser(res.data);
    } catch (error) {
      // Se der erro (token expirado), desloga
      logout();
    } finally {
      setLoading(false);
    }
  }

  function login(token: string) {
    localStorage.setItem('nutri_token', token);
    checkUser();
  }

  function logout() {
    localStorage.removeItem('nutri_token');
    setUser(null);
  }

  useEffect(() => {
    checkUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);