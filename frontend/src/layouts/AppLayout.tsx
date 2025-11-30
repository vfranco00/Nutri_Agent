import { type ReactNode, useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';

interface AppLayoutProps {
  children: ReactNode;
  accentColor?: string; // Para o tema da página (laranja, verde, etc)
}

export function AppLayout({ children, accentColor = 'zinc' }: AppLayoutProps) {
  // Lógica do Tema Escuro/Claro
  const [isDark, setIsDark] = useState(() => {
    // Tenta pegar do localStorage ou usa preferência do sistema
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true; // Default Dark
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex transition-colors duration-300">
      <Sidebar toggleTheme={() => setIsDark(!isDark)} isDark={isDark} />
      
      {/* Área de Conteúdo */}
      <main className="flex-1 ml-20 lg:ml-64 p-4 lg:p-8 overflow-y-auto h-screen transition-all">
        <div className={`max-w-7xl mx-auto animate-fadeIn ${accentColor}`}>
          {children}
        </div>
      </main>
    </div>
  );
}