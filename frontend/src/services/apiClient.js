import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api', // Pointing to Node.js!
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;