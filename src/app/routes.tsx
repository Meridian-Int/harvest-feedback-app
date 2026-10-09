import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RequireAdmin } from './RequireAdmin';
import { RequireSignedIn } from './RequireSignedIn';
import { AccountSetupPage } from './AccountSetupPage';
import { SignInPage } from './SignInPage';
import { NewFeedbackPage } from '../features/client/NewFeedbackPage';
import { MyReportsPage } from '../features/client/MyReportsPage';
import { ReviewPage } from '../features/admin/ReviewPage';
import { InsightsPage } from '../features/admin/InsightsPage';
import { InvitePartnerPage } from '../features/admin/InvitePartnerPage';
import { isAdmin } from '../lib/auth';
import { useAuth } from './AuthProvider';

function Landing() {
  const { user } = useAuth();
  return <Navigate to={!user ? '/sign-in' : isAdmin(user) ? '/admin/reviews' : '/feedback/new'} replace />;
}
export function AppRoutes() {
  return <Routes>
    <Route path="/account/setup" element={<AccountSetupPage />} />
    <Route path="/sign-in" element={<SignInPage />} />
    <Route element={<RequireSignedIn />}><Route element={<AppShell />}>
      <Route path="/feedback/new" element={<NewFeedbackPage />} />
      <Route path="/feedback/mine" element={<MyReportsPage />} />
      <Route element={<RequireAdmin />}>
        <Route path="/admin/reviews" element={<ReviewPage />} />
        <Route path="/admin/insights" element={<InsightsPage />} />
        <Route path="/admin/invite" element={<InvitePartnerPage />} />
        <Route path="/admin/*" element={<Navigate to="/admin/reviews" replace />} />
      </Route>
    </Route></Route>
    <Route path="*" element={<Landing />} />
  </Routes>;
}
