import axios from 'axios';

const engineClient = axios.create({
  baseURL: import.meta.env.VITE_ENGINE_URL || 'http://localhost:8000',
});

export default engineClient;