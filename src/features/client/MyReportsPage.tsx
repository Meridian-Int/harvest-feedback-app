import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { MyReportsView } from './MyReportsView';
import { clientApi, clientControls } from './foundation';

export function MyReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const state = location.state as { clientReportOverlay?: boolean; message?: string } | null;
  if (!user) return null;
  function close() {
    if (state?.clientReportOverlay) { navigate(-1); return; }
    const next = new URLSearchParams(search); next.delete('report');
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  }
  return <MyReportsView key={user.id} api={clientApi} controls={clientControls} reportId={search.get('report')}
    onOpenReport={id => navigate(`/feedback/mine?report=${encodeURIComponent(id)}`, { state: { clientReportOverlay: true } })}
    onCloseReport={close} onNewFeedback={() => navigate('/feedback/new')} initialMessage={state?.message} />;
}
