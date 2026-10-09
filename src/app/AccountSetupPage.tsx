import { Navigate } from 'react-router-dom';
import { isAdmin } from '../lib/auth';
import { useAuth } from './AuthProvider';

// Keep old setup links usable while account-type selection is disabled.
export function AccountSetupPage() {
  const { user } = useAuth();
  return <Navigate to={!user ? '/sign-in' : isAdmin(user) ? '/admin/reviews' : '/feedback/new'} replace />;
}
