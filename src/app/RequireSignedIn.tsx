import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireSignedIn() {
  const { user } = useAuth();
  return !user ? <Navigate to="/sign-in" replace /> : user.needsPersonaSetup ? <Navigate to="/account/setup" replace /> : <Outlet />;
}
