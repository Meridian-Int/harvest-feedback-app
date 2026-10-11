import { Navigate, useNavigate } from 'react-router-dom';
import { Button, ThemeToggle } from '../components/ui';
import { isAdmin, selectHarvestOrganization } from '../lib/auth';
import { useAuth } from './AuthProvider';

export function OrganizationPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!user.harvest?.organizationRequired) return <Navigate to={isAdmin(user) ? '/admin/reviews' : '/feedback/new'} replace />;
  const memberships = user.harvest.memberships;
  return <section className="auth-screen" aria-labelledby="organization-heading">
    <div className="auth-top"><span>HARVEST</span><ThemeToggle /></div>
    <div className="auth-card glass">
      <div className="auth-brand">Meridian<br />Intelligence</div><div className="auth-divider" />
      <h1 id="organization-heading">Choose an organization</h1>
      <p className="auth-subtitle">Choose which organization you are reporting for.</p>
      <div className="organization-options">
        {memberships.map(item => <Button key={item.orgId} type="button" variant="quiet" onClick={() => {
          const selected = selectHarvestOrganization(item.orgId);
          setUser(selected);
          navigate(isAdmin(selected) ? '/admin/reviews' : '/feedback/new', { replace: true });
        }}>{item.orgName} · {item.orgKind === 'operator' ? 'Operator' : item.orgKind === 'partner' ? 'Partner' : 'Company'}</Button>)}
      </div>
    </div>
    <div className="auth-bottom">HARVEST · By Meridian Intelligence</div>
  </section>;
}
