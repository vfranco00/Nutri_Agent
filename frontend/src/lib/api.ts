import axios from 'axios';

export const api = axios.create({
  // baseURL: import.meta.env.VITE_API_URL || "https://nutriagentbackend-txazatal.b4a.run/",
  baseURL: import.meta.env.VITE_API_URL || "https://nutri-agent-api.onrender.com",
});

// Antes de cada requisição, verifica se tem token salvo e injeta no header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nutri_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Se qualquer requisição (menos o login, onde 401 é só "senha errada") vier com
// 401, o token não vale mais — desloga e manda pro login em vez de deixar a
// tela "travada" sem o usuário perceber que a sessão caiu.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('nutri_token');
      localStorage.removeItem('nutri_current_plan');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);