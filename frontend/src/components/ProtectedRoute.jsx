import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

export default function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  
  // If we have a token, render the child routes (Outlet). 
  // Otherwise, kick them back to login.
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}