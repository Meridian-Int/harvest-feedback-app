import { Navigate, Outlet } from 'react-router-dom';
import { isAdmin } from '../lib/auth';
import { useAuth } from './AuthProvider';
import { appPaths } from './paths';

export function RequireAdmin() {
  const { user } = useAuth();
  return !user ? <Navigate to={appPaths.signIn} replace /> : isAdmin(user) ? <Outlet /> : <Navigate to={appPaths.newFeedback} replace />;
}
