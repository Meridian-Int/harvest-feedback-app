import { Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ClientProps } from './contract';
import { NewFeedbackForm as NewFeedbackPage } from './NewFeedbackForm';
import { MyReportsView as MyReportsPage } from './MyReportsView';

// Mount beneath the foundation's authenticated client guard and shell at /feedback/*.
// Never use this route wrapper to replace backend ownership authorization.
export function ClientRoutes(props: ClientProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const state = location.state as { clientReportOverlay?: boolean; message?: string } | null;
  const open = (id: string) => navigate(`/feedback/mine?report=${encodeURIComponent(id)}`, { state: { clientReportOverlay: true } });
  const close = () => {
    if (state?.clientReportOverlay) { navigate(-1); return; }
    const next = new URLSearchParams(search); next.delete('report');
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  };
  return <Routes>
    <Route path="new" element={<NewFeedbackPage key={props.draftScope} {...props} onOpenReport={open} onSubmitted={() => navigate('/feedback/mine', { state: { message: 'Feedback submitted. You can track it in My reports.' } })} />} />
    <Route path="mine" element={<MyReportsPage key={props.draftScope} api={props.api} controls={props.controls} reportId={search.get('report')} onOpenReport={open} onCloseReport={close} onNewFeedback={() => navigate('/feedback/new')} initialMessage={state?.message} />} />
  </Routes>;
}
