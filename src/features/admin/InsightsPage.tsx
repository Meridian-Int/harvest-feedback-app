import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, Panel, SegmentedControl, Select } from '../../components/ui';
import { createFeedback, listAllFeedback } from '../../lib/feedback';
import { formatDateTime } from '../../lib/format';
import { getSentryIssues, type SentryIssuesResult } from '../../lib/insights';
import { SENTRY_PROJECTS } from '../../lib/options';
import type { Feedback, SentryIssue } from '../../lib/types';
import { filterIssues, issueMetrics, linkedReport, lookerEmbedUrl, reportFromIssue } from './logic/insights';
import './insights.css';

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return <Panel className="signal-metric"><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{helper}</small></Panel>;
}

function IssueRow({ issue, report, busy, creating, onAction }: { issue: SentryIssue; report?: Feedback; busy: boolean; creating: boolean; onAction: () => void }) {
  const maximum = Math.max(1, ...issue.trend);
  return <article className="insight-error-row">
    <span className={`insight-error-level ${['error', 'fatal'].includes(issue.level.toLowerCase()) ? 'is-error' : ''}`} title={issue.level} aria-label={issue.level} />
    <div className="insight-error-description"><h3>{issue.title}</h3><div className="insight-error-meta"><span className="tag">{issue.project}</span><span>{issue.culprit}</span><span>Last seen {formatDateTime(issue.lastSeen)}</span></div></div>
    <div className="insight-error-spark" aria-hidden="true">{issue.trend.map((value, index) => <i key={index} style={{ height: `${Math.max(2, Math.round(value / maximum * 28))}px` }} />)}</div>
    <div className="insight-error-count"><span>{issue.count.toLocaleString()} events</span><small>{issue.userCount.toLocaleString()} users</small></div>
    <Button variant="quiet" disabled={busy} onClick={onAction}>{creating ? 'Creating…' : report ? 'View report' : 'Make a report'}</Button>
  </article>;
}

export function InsightsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('tab') === 'traffic' ? 'traffic' : 'errors';
  const [project, setProject] = useState('');
  const [result, setResult] = useState<SentryIssuesResult | null>(null);
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(tab === 'errors');
  const [error, setError] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const embedUrl = lookerEmbedUrl(import.meta.env.VITE_LOOKER_EMBED_URL);
  const visibleIssues = filterIssues(result?.issues ?? [], project);
  const metrics = issueMetrics(visibleIssues);

  useEffect(() => {
    if (tab !== 'errors') return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([getSentryIssues(), listAllFeedback()]).then(([issues, feedback]) => {
      if (active) { setResult(issues); setReports(feedback); }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load Sentry issues.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab]);

  function changeTab(value: 'errors' | 'traffic') {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next);
  }

  async function openOrCreate(issue: SentryIssue) {
    const existing = linkedReport(issue, reports);
    if (existing) { navigate(`/admin/reviews?report=${encodeURIComponent(existing.id)}`); return; }
    setCreatingId(issue.id);
    setError(null);
    try {
      const latest = linkedReport(issue, await listAllFeedback());
      const report = latest ?? await createFeedback(reportFromIssue(issue));
      navigate(`/admin/reviews?report=${encodeURIComponent(report.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the report.');
    } finally {
      setCreatingId(null);
    }
  }

  return <section id="view-admin-insights">
    <div className="pagehead"><div><h1>Product insights</h1><p>Application health and usage</p></div><SegmentedControl label="Insight view" value={tab} options={[{ value: 'errors', label: 'Errors' }, { value: 'traffic', label: 'Traffic' }]} onChange={changeTab} /></div>
    {tab === 'errors' ? <div id="insights-errors">
      <div className="signal-summary">
        <Metric label="Issues" value={metrics.issues} helper="Unique error groups" />
        <Metric label="Events" value={metrics.events} helper="Total occurrences" />
        <Metric label="Projects" value={metrics.projects} helper="Affected applications" />
      </div>
      <Panel className="insight-issues-panel" heading={<div><h2>Errors</h2><p className="helper">Sentry · grouped by issue</p></div>} actions={<label className="project-filter">Project <Select aria-label="Project" value={project} onChange={event => setProject(event.target.value)}><option value="">All projects</option>{SENTRY_PROJECTS.map(value => <option key={value} value={value}>{value}</option>)}</Select></label>}>
        {loading ? <EmptyState>Loading Sentry issues…</EmptyState> : error ? <EmptyState>{error}</EmptyState> : !result?.configured ? <EmptyState>Connect Sentry to see application errors here.</EmptyState> : visibleIssues.length ? visibleIssues.map(issue => <IssueRow key={issue.id} issue={issue} report={linkedReport(issue, reports)} busy={creatingId !== null} creating={creatingId === issue.id} onAction={() => { void openOrCreate(issue); }} />) : <EmptyState>No issues for this project.</EmptyState>}
      </Panel>
    </div> : <Panel className="insight-traffic-panel" heading="Traffic">
      {embedUrl ? <iframe title="HARVEST traffic report" src={embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /> : <EmptyState>Connect a Looker Studio embed URL to see Google Analytics traffic here.</EmptyState>}
    </Panel>}
  </section>;
}
