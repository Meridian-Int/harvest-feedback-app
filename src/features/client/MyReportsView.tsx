import { useRecordingWorkspace } from './recordingWorkspace';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientApi, ClientControls, Feedback, Status } from './contract';
import { displayId, reportPage, STATUS_LABELS, updatePending } from './logic/reports';
import { ProgressTrack, ReportDetailDialog, ReportPills } from './ReportDetailDialog';
import './client.css';

export function MyReportsView({ api, controls, reportId, onOpenReport, onCloseReport, onNewFeedback, initialMessage = '', draftScope }: { api: ClientApi; controls: ClientControls; reportId: string | null; onOpenReport: (id: string) => void; onCloseReport: () => void; onNewFeedback: () => void; initialMessage?: string; draftScope?: string }) {
  useRecordingWorkspace(draftScope);
  const [reports, setReports] = useState<Feedback[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState('');
  const [requestedPage, setPage] = useState(1);
  const [layout, setLayout] = useState<'list' | 'grid'>(() => { try { return localStorage.getItem('harvest-client-layout') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } });
  const [message, setMessage] = useState(initialMessage);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setState('loading');
    try { const result = await api.listMyFeedback(); if (generation.current === current) { setReports(result); setState('ready'); } }
    catch { if (generation.current === current) setState('error'); }
  }, [api]);
  useEffect(() => {
    void load();
    const unsubscribe = api.subscribeMyFeedback?.(result => { generation.current++; setReports(result); setState('ready'); }, () => setState('error'));
    return () => { generation.current++; unsubscribe?.(); };
  }, [api, load]);
  const page = reportPage(reports, status, requestedPage);
  useEffect(() => { setPage(page.page); }, [page.page]);
  const chooseLayout = (value: 'list' | 'grid') => { setLayout(value); try { localStorage.setItem('harvest-client-layout', value); } catch { /* session choice still works */ } };
  async function request(report: Feedback) {
    if (report.status === 'CLOSED' || updatePending(report) || inFlight.current.has(report.id)) return;
    inFlight.current.add(report.id); setBusyIds(new Set(inFlight.current));
    try {
      await api.requestUpdate(report.id);
      // Refresh authoritative timestamps; do not manufacture an admin/request time.
      const updated = await api.getFeedback(report.id);
      if (updated) setReports(current => current.map(row => row.id === updated.id ? updated : row));
      setMessage('Update requested.');
    } catch { setMessage('Could not request an update. Try again.'); }
    finally { inFlight.current.delete(report.id); setBusyIds(new Set(inFlight.current)); }
  }
  const { Panel, Button, Select } = controls;
  return <section className="harvest-client client-mine">
    <header className="client-pagehead"><div><h1>My reports</h1><p>Follow your feedback from the first report to the fix.</p></div><Button onClick={onNewFeedback}>New feedback</Button></header>
    <Panel className="client-panel"><header className="client-panel-head"><h2>Your reports</h2><div className="client-report-toolbar"><div className="client-segment" role="group" aria-label="Report layout">{(['list', 'grid'] as const).map(value => <Button key={value} aria-pressed={layout === value} onClick={() => chooseLayout(value)}>{value === 'list' ? 'List' : 'Grid'}</Button>)}</div><label htmlFor="client-status">Status <Select id="client-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All reports</option>{(Object.keys(STATUS_LABELS) as Status[]).map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</Select></label></div></header>
      <div className="client-legend"><span>Newest reports first</span><span>Select the arrow to view the description</span></div>
      <div className="client-reports" data-layout={layout} aria-busy={state === 'loading'}>
        {state === 'loading' && <p className="client-empty" role="status">Loading reports…</p>}
        {state === 'error' && <div className="client-empty" role="alert">Could not load your reports. <Button onClick={() => void load()}>Try again</Button></div>}
        {state === 'ready' && !page.total && <p className="client-empty">{reports.length ? 'No reports match this status.' : 'No reports yet. Submit feedback to see it here.'}</p>}
        {state === 'ready' && page.rows.map(report => <article className="client-report" data-closed={report.status === 'CLOSED'} key={report.id}>
          <div className="client-report-main"><div className="client-report-heading"><button className="client-report-title" onClick={() => onOpenReport(report.id)}>{report.title}</button><span className="client-helper">{displayId(report.id)} · {report.customArea || report.productArea} · {new Date(report.createdAt).toLocaleDateString()}</span></div><ProgressTrack status={report.status} compact /></div>
          <div className="client-tag-column"><ReportPills report={report} />{report.status !== 'CLOSED' && <Button className="client-update" disabled={updatePending(report) || busyIds.has(report.id)} onClick={() => void request(report)}>{updatePending(report) ? 'Update requested' : busyIds.has(report.id) ? 'Requesting…' : 'Request update'}</Button>}</div>
          <Button className="client-arrow" aria-label={`View description: ${report.title}`} onClick={() => onOpenReport(report.id)}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></Button>
        </article>)}
      </div>
      <nav className="client-pagination" aria-label="My reports pages"><span role="status" className="client-helper">{page.range}</span><div><Button disabled={page.page === 1 || state !== 'ready'} onClick={() => setPage(page.page - 1)}>Previous</Button><span>Page {page.page} of {page.pages}</span><Button disabled={page.page === page.pages || state !== 'ready'} onClick={() => setPage(page.page + 1)}>Next</Button></div></nav>
    </Panel>
    {message && <p role="status" className="client-toast">{message}</p>}
    {reportId && <ReportDetailDialog id={reportId} api={api} controls={controls} onClose={onCloseReport} />}
  </section>;
}
