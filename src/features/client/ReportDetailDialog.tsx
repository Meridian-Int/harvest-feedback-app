import { Pill, ProgressTrack } from '../../components/ui';
import type { Priority } from '../../lib/types';
import { useEffect, useState } from 'react';
import type { ClientApi, ClientControls, Feedback } from './contract';
import { ClientDialog } from './ClientDialog';
import { displayId } from './logic/reports';

export { ProgressTrack } from '../../components/ui';
export function ReportPills({ report }: { report: Feedback }) {
  return <div className="client-tags"><Pill value={report.priority as Priority} />{report.priority === 'BLOCKER' && <Pill value="CRITICAL" />}</div>;
}
export function ReportDetailDialog({ id, api, controls, onClose }: { id: string; api: ClientApi; controls: ClientControls; onClose: () => void }) {
  const [report, setReport] = useState<Feedback | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState('loading'); setReport(null);
    api.getFeedback(id).then(result => { if (active) { setReport(result); setState(result ? 'ready' : 'missing'); } }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [id, api, retry]);
  const { Button } = controls;
  return <ClientDialog title={report ? `${displayId(report.id)} · ${new Date(report.createdAt).toLocaleString()}` : 'Report details'} onClose={onClose}>
    <div className="client-detail-body">
      {state === 'loading' && <p role="status">Loading report…</p>}
      {state === 'missing' && <p role="alert">This report is unavailable or you do not have access to it.</p>}
      {state === 'error' && <div role="alert">Could not load this report. <Button onClick={() => setRetry(value => value + 1)}>Try again</Button></div>}
      {state === 'ready' && report && <><h2>{report.title}</h2><ReportPills report={report} /><ProgressTrack status={report.status} /><span className="client-helper">Description</span><p className="client-description">{report.description}</p></>}
    </div>
    <footer className="client-dialog-footer"><Button onClick={onClose}>Done</Button></footer>
  </ClientDialog>;
}
