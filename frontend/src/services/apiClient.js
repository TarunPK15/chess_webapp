import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

const apiClient = axios.create({
  // This tells Vite: "If I have an environment variable, use it. Otherwise, use localhost."
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', 
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;