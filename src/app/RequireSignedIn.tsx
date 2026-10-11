import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireSignedIn() {
  const { user } = useAuth();
  return !user || user.needsPasswordSetup ? <Navigate to="/sign-in" replace /> : <Outlet />;
}
