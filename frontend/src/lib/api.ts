import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://nutriagentbackend-txazatal.b4a.run/",
});

// Antes de cada requisição, verifica se tem token salvo e injeta no header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nutri_token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});