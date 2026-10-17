import { useLayoutEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../components/icons';
import { IconButton, ThemeToggle } from '../components/ui';
import { isAdmin } from '../lib/auth';
import { isHarvestSharedSessionMode, isLocalFeedbackPreview } from '../lib/amplify';
import { useAuth } from './AuthProvider';
import { NotificationCenter } from './NotificationCenter';
import { appPaths } from './paths';

export function AppShell() {
  const { user, logOut } = useAuth();
  const { pathname } = useLocation();
  const admin = isAdmin(user);
  const [error, setError] = useState<string | null>(null);
  const reportsPage = pathname === appPaths.myReports || pathname === appPaths.adminReviews;
  const links: { to: string; text: string; icon: IconName }[] = admin ? [
    { to: appPaths.adminReviews, text: 'Review queue', icon: 'list' }, { to: appPaths.adminInsights, text: 'Insights', icon: 'chart' },
  ] : [{ to: appPaths.newFeedback, text: 'New feedback', icon: 'plus' }, { to: appPaths.myReports, text: 'My reports', icon: 'list' }];
  const crumb = pathname === appPaths.newFeedback ? 'New feedback' : pathname === appPaths.myReports ? 'My reports' : pathname === appPaths.adminReviews ? 'Feedback review' : 'Product insights';
  useLayoutEffect(() => {
    document.documentElement.dataset.page = reportsPage ? 'reports' : 'workspace';
    return () => { delete document.documentElement.dataset.page; };
  }, [reportsPage]);
  return <div className={`layout ${reportsPage ? 'layout-reports' : ''} ${admin ? 'admin-workspace' : ''}`}>
    <aside className="rail">
      <div className="brand"><svg className="brandmark" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="46" /><path d="M50 4 L74 50 L50 96 L26 50 Z" /><path d="M50 4 V96" /><path d="M4 50 H26 M74 50 H96" /></svg><span>FEEDBACK</span></div>
      <div className="nav-label eyebrow">Feedback workspace</div>
      <nav className="workspace-nav" aria-label="Workspace">{links.map(link => <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? 'active' : ''}><Icon name={link.icon} />{link.text}</NavLink>)}</nav>
      <div className="rail-bottom">
        <div className="user"><span className="avatar" aria-hidden="true">{user?.name.slice(0, 2).toUpperCase()}</span><div><div>{user?.name}</div><div className="user-role">{admin ? 'Admin' : user?.email}</div></div></div>
        <IconButton label={isHarvestSharedSessionMode() ? 'Return to HARVEST' : 'Sign out'} className="rail-sign-out" onClick={() => { void logOut().catch(e => setError((e as Error).message)); }}><Icon name="logout" /><span>{isHarvestSharedSessionMode() ? 'Return to HARVEST' : 'Sign out'}</span></IconButton>
      </div>
    </aside>
    <div className="workspace-main">
      <header className="top"><div className="breadcrumb">Workspace <span>/</span> <strong>{crumb}</strong></div><div className="top-actions">{user && <NotificationCenter key={user.id} user={user} />}<ThemeToggle /></div></header>
      <main>{isLocalFeedbackPreview() && <p className="local-preview-note" role="status">Local UI preview · Reports and uploads are unavailable until the Feedback dev backend is connected.</p>}{error && <p role="alert" className="error">{error}</p>}<Outlet /></main>
    </div>
  </div>;
}
