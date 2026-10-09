import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../components/icons';
import { TextButton, ThemeToggle, Toast } from '../components/ui';
import { isAdmin } from '../lib/auth';
import { observeAllFeedback } from '../lib/feedback';
import { useAuth } from './AuthProvider';

export function AppShell() {
  const { user, logOut } = useAuth();
  const { pathname } = useLocation();
  const admin = isAdmin(user);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const knownReports = useRef<Set<string> | null>(null);
  const reportsPage = pathname === '/feedback/mine' || pathname === '/admin/reviews';
  const links: { to: string; text: string; icon: IconName }[] = admin ? [
    { to: '/admin/reviews', text: 'Review queue', icon: 'list' }, { to: '/admin/insights', text: 'Insights', icon: 'chart' },
  ] : [{ to: '/feedback/new', text: 'New feedback', icon: 'plus' }, { to: '/feedback/mine', text: 'My reports', icon: 'list' }];
  const crumb = pathname === '/feedback/new' ? 'New feedback' : pathname === '/feedback/mine' ? 'My reports' : pathname === '/admin/reviews' ? 'Feedback review' : 'Product insights';
  useEffect(() => {
    if (!admin) return;
    try {
      return observeAllFeedback(rows => {
        const ids = new Set(rows.map(report => report.id));
        if (knownReports.current) {
          const newest = rows.find(report => !knownReports.current?.has(report.id) && report.status === 'NEW');
          if (newest) setNotification(`New report from ${newest.company}. Open Review queue to see it.`);
        }
        knownReports.current = ids;
      }, cause => setError(cause.message));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not watch reports.');
    }
  }, [admin]);
  useLayoutEffect(() => {
    document.documentElement.dataset.page = reportsPage ? 'reports' : 'workspace';
    return () => { delete document.documentElement.dataset.page; };
  }, [reportsPage]);
  return <div className={`layout ${reportsPage ? 'layout-reports' : ''} ${admin ? 'admin-workspace' : ''}`}>
    <aside className="rail">
      <div className="brand">HARVEST</div><div className="brand-sub">BY MERIDIAN INTELLIGENCE</div>
      <div className="nav-label eyebrow">Feedback workspace</div>
      <nav className="workspace-nav" aria-label="Workspace">{links.map(link => <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? 'active' : ''}><Icon name={link.icon} />{link.text}</NavLink>)}</nav>
      <div className="rail-bottom"><div className="user"><span className="avatar" aria-hidden="true">{user?.name.slice(0, 2).toUpperCase()}</span><div><div>{user?.name}</div><div className="user-role">{admin ? 'Admin' : user?.email}</div></div></div></div>
    </aside>
    <div className="workspace-main">
      <header className="top"><div className="breadcrumb">Workspace <span>/</span> <strong>{crumb}</strong></div><div className="top-actions"><TextButton onClick={() => { void logOut().catch(e => setError((e as Error).message)); }}>Sign out</TextButton><ThemeToggle /></div></header>
      <main>{error && <p role="alert" className="error">{error}</p>}<Outlet /></main>
      <Toast message={notification} onDismiss={() => setNotification(null)} />
    </div>
  </div>;
}
