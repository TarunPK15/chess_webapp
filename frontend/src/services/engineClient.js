import axios from 'axios';

const engineClient = axios.create({
  baseURL: 'http://localhost:8000', // Pointing to FastAPI!
});

export default engineClient;