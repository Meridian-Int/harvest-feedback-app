import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireSignedIn() {
  return useAuth().user ? <Outlet /> : <Navigate to="/sign-in" replace />;
}
