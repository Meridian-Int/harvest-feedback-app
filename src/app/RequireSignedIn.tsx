import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireSignedIn() {
  const { user } = useAuth();
  return !user ? <Navigate to="/sign-in" replace />
    : user.harvest?.organizationRequired ? <Navigate to="/account/organization" replace />
      : <Outlet />;
}
