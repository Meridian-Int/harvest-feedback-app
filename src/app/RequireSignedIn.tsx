import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { appPaths } from './paths';

export function RequireSignedIn() {
  const { user } = useAuth();
  return !user ? <Navigate to={appPaths.signIn} replace />
    : user.harvest?.organizationRequired ? <Navigate to={appPaths.organization} replace />
      : <Outlet />;
}
