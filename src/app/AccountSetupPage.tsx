import { Navigate } from 'react-router-dom';
import { isAdmin } from '../lib/auth';
import { useAuth } from './AuthProvider';
import { appPaths } from './paths';

// Keep old setup links usable while account-type selection is disabled.
export function AccountSetupPage() {
  const { user } = useAuth();
  return <Navigate to={!user ? appPaths.signIn : isAdmin(user) ? appPaths.adminReviews : appPaths.newFeedback} replace />;
}
