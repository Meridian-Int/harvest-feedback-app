import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RequireAdmin } from './RequireAdmin';
import { RequireSignedIn } from './RequireSignedIn';
import { AccountSetupPage } from './AccountSetupPage';
import { SignInPage } from './SignInPage';
import { OrganizationPage } from './OrganizationPage';
import { NewFeedbackPage } from '../features/client/NewFeedbackPage';
import { MyReportsPage } from '../features/client/MyReportsPage';
import { ReviewPage } from '../features/admin/ReviewPage';
import { InsightsPage } from '../features/admin/InsightsPage';
import { isAdmin } from '../lib/auth';
import { useAuth } from './AuthProvider';
import { appPaths } from './paths';

function Landing() {
  const { user } = useAuth();
  return <Navigate to={!user ? appPaths.signIn : user.harvest?.organizationRequired ? appPaths.organization : isAdmin(user) ? appPaths.adminReviews : appPaths.newFeedback} replace />;
}
export function AppRoutes() {
  return <Routes>
    <Route path="/account/setup" element={<AccountSetupPage />} />
    <Route path="/sign-in" element={<SignInPage />} />
    <Route path={appPaths.organization} element={<OrganizationPage />} />
    <Route element={<RequireSignedIn />}><Route element={<AppShell />}>
      <Route path={appPaths.newFeedback} element={<NewFeedbackPage />} />
      <Route path={appPaths.myReports} element={<MyReportsPage />} />
      <Route element={<RequireAdmin />}>
        <Route path={appPaths.adminReviews} element={<ReviewPage />} />
        <Route path={appPaths.adminInsights} element={<InsightsPage />} />
        <Route path={appPaths.adminReviews.replace(/\/reviews$/, '/*')} element={<Navigate to={appPaths.adminReviews} replace />} />
      </Route>
    </Route></Route>
    <Route path="*" element={<Landing />} />
  </Routes>;
}
