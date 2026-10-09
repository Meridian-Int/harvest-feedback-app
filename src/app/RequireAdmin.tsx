import { Navigate, Outlet } from 'react-router-dom';
import { isAdmin } from '../lib/auth';
import { useAuth } from './AuthProvider';

export function RequireAdmin() {
  const { user } = useAuth();
  return !user ? <Navigate to="/sign-in" replace /> : isAdmin(user) ? <Outlet /> : <Navigate to="/feedback/new" replace />;
}
