import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, Panel, SegmentedControl, Select, Tag } from '../../components/ui';
import { createFeedback, listAllFeedback } from '../../lib/feedback';
import { formatDateTime } from '../../lib/format';
import { getSentryIssues, getTrafficInsights, type SentryIssuesResult, type TrafficInsightsResult } from '../../lib/insights';
import { SENTRY_PROJECTS } from '../../lib/options';
import type { Feedback, SentryIssue } from '../../lib/types';
import { filterIssues, issueMetrics, linkedReport, lookerEmbedUrl, reportFromIssue } from './logic/insights';
import { SAMPLE_ISSUES, SAMPLE_TRAFFIC, type SampleIssue } from './sampleInsights';
import { appPaths } from '../../app/paths';
import './insights.css';

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return <Panel className="signal-metric"><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{helper}</small></Panel>;
}

function IssueRow({ issue, report, busy, creating, sample, onAction }: { issue: SentryIssue | SampleIssue; report?: Feedback; busy: boolean; creating: boolean; sample: boolean; onAction: () => void }) {
  const maximum = Math.max(1, ...issue.trend);
  const seen = sample && 'seen' in issue ? issue.seen : formatDateTime(issue.lastSeen);
  return <article className="insight-error-row">
    <span className={`insight-error-level ${['error', 'fatal'].includes(issue.level.toLowerCase()) ? 'is-error' : ''}`} title={issue.level} aria-label={issue.level} />
    <div className="insight-error-description"><h3>{issue.title}</h3><div className="insight-error-meta"><span className="tag">{issue.project}</span><span>{issue.culprit}</span><span>Last seen {seen}</span></div></div>
    <div className="insight-error-spark" aria-hidden="true">{issue.trend.map((value, index) => <i key={index} style={{ height: `${Math.max(2, Math.round(value / maximum * 28))}px` }} />)}</div>
    <div className="insight-error-count"><span>{issue.count.toLocaleString()} events</span><small>{issue.userCount.toLocaleString()} users</small></div>
    <Button variant="quiet" disabled={busy || sample} title={sample ? 'Connect Sentry to make a report.' : undefined} onClick={onAction}>{creating ? 'Creating…' : report ? 'View report' : 'Make a report'}</Button>
  </article>;
}

function TrafficOverview({ live }: { live: TrafficInsightsResult | null }) {
  const days = live ? live.days.map(({ day, users }) => ({ day: new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }), users })) : SAMPLE_TRAFFIC.days;
  const pages = live?.pages ?? SAMPLE_TRAFFIC.pages;
  const maximumUsers = Math.max(1, ...days.map(day => day.users));
  const maximumViews = Math.max(1, ...pages.map(page => page.views));
  return <div id="insights-traffic">
    <div className="signal-summary">
      <Metric label="Users" value={live?.users ?? SAMPLE_TRAFFIC.users} helper="Unique visitors in the last 7 complete days" />
      <Metric label="Sessions" value={live?.sessions ?? SAMPLE_TRAFFIC.sessions} helper="HARVEST sessions" />
      <Metric label={live ? 'Page views' : 'Reports sent'} value={live?.pageViews ?? SAMPLE_TRAFFIC.reportsSent} helper={live ? 'HARVEST pages viewed' : 'Across all client workspaces'} />
    </div>
    <div className="insight-traffic-layout">
      <Panel className="insight-traffic-chart-panel" heading="Users over time" actions={<Tag>7 DAYS</Tag>}>
        <div className="insight-traffic-chart" role="img" aria-label={live ? 'Daily active HARVEST users for the last 7 complete days' : 'Sample daily active users from Friday to Thursday'}>
          {days.map(({ day, users }, index) => <div key={`${day}-${index}`}><span>{users}</span><i style={{ height: `${Math.max(2, Math.round(users / maximumUsers * 112))}px` }} /><small>{day}</small></div>)}
        </div>
        <p className="insight-chart-caption">{live ? 'Daily active users · last 7 complete days' : 'Daily active users · Oct 2–8'}</p>
      </Panel>
      <Panel className="insight-top-pages-panel" heading="Top pages" actions={<span className="helper">Page views</span>}>
        <div className="insight-top-pages">
          {pages.map(({ name, views }) => <div className="insight-page-traffic" key={name}>
            <span>{name}</span><span>{views}</span><div><i style={{ width: `${views / maximumViews * 100}%` }} /></div>
          </div>)}
        </div>
      </Panel>
    </div>
    <p className="insight-footnote">{live ? 'HARVEST prestaging Google Analytics · last 7 complete days.' : 'Google Analytics / Looker Studio layout preview. Sample values; no live accounts connected.'}</p>
  </div>;
}

export function InsightsPage({ lookerUrl = import.meta.env.VITE_LOOKER_EMBED_URL }: { lookerUrl?: string } = {}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('tab') === 'traffic' ? 'traffic' : 'errors';
  const [project, setProject] = useState('');
  const [result, setResult] = useState<SentryIssuesResult | null>(null);
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(tab === 'errors');
  const [error, setError] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const embedUrl = lookerEmbedUrl(lookerUrl);
  const [traffic, setTraffic] = useState<TrafficInsightsResult | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const sampleErrors = result?.configured === false;
  const projectChoices = sampleErrors ? SENTRY_PROJECTS : [...new Set((result?.issues ?? []).map(issue => issue.project))].sort();
  const visibleIssues = filterIssues(sampleErrors ? SAMPLE_ISSUES : result?.issues ?? [], project);
  const metrics = issueMetrics(visibleIssues);

  useEffect(() => {
    if (tab !== 'errors') return;
    let active = true;
    setLoading(true);
    setError(null);
    getSentryIssues().then(async issues => {
      if (!active) return;
      if (!issues.configured) { setResult(issues); setReports([]); return; }
      const feedback = await listAllFeedback();
      if (active) { setResult(issues); setReports(feedback); }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load Sentry issues.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'traffic' || embedUrl) return;
    let active = true;
    setTrafficLoading(true);
    setTrafficError(null);
    getTrafficInsights().then(result => { if (active) setTraffic(result); })
      .catch(cause => { if (active) setTrafficError(cause instanceof Error ? cause.message : 'Could not load GA4 traffic.'); })
      .finally(() => { if (active) setTrafficLoading(false); });
    return () => { active = false; };
  }, [tab, embedUrl]);

  function changeTab(value: 'errors' | 'traffic') {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next);
  }

  async function openOrCreate(issue: SentryIssue) {
    const existing = linkedReport(issue, reports);
    if (existing) { navigate(`${appPaths.adminReviews}?report=${encodeURIComponent(existing.id)}`); return; }
    setCreatingId(issue.id);
    setError(null);
    try {
      const latest = linkedReport(issue, await listAllFeedback());
      const report = latest ?? await createFeedback(reportFromIssue(issue));
      navigate(`${appPaths.adminReviews}?report=${encodeURIComponent(report.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the report.');
    } finally {
      setCreatingId(null);
    }
  }

  return <section id="view-admin-insights">
    <div className="pagehead"><div><h1>Product insights</h1><p>Application health and usage{(tab === 'errors' && sampleErrors || tab === 'traffic' && !embedUrl && traffic?.configured === false) ? ' · sample data' : ''}</p></div><SegmentedControl label="Insight view" value={tab} options={[{ value: 'errors', label: 'Errors' }, { value: 'traffic', label: 'Traffic' }]} onChange={changeTab} /></div>
    {tab === 'errors' ? <div id="insights-errors">
      <div className="signal-summary">
        <Metric label="Issues" value={metrics.issues} helper="Unique error groups" />
        <Metric label="Events" value={metrics.events} helper="Total occurrences" />
        <Metric label="Projects" value={metrics.projects} helper="Affected applications" />
      </div>
      <Panel className="insight-issues-panel" heading={<div><h2>Errors</h2><p className="helper">Sentry · grouped by issue</p></div>} actions={<label className="project-filter">Project <Select aria-label="Project" value={project} onChange={event => setProject(event.target.value)}><option value="">All projects</option>{projectChoices.map(value => <option key={value} value={value}>{value}</option>)}</Select></label>}>
        {loading ? <EmptyState>Loading Sentry issues…</EmptyState> : error ? <EmptyState>{error}</EmptyState> : visibleIssues.length ? visibleIssues.map(issue => <IssueRow key={issue.id} issue={issue} report={sampleErrors ? undefined : linkedReport(issue, reports)} busy={creatingId !== null} creating={creatingId === issue.id} sample={sampleErrors} onAction={() => { if (!sampleErrors) void openOrCreate(issue); }} />) : <EmptyState>No issues for this project.</EmptyState>}
      </Panel>
    </div> : embedUrl ? <Panel className="insight-traffic-panel" heading="Traffic"><iframe title="HARVEST traffic report" src={embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></Panel> : trafficLoading ? <EmptyState>Loading GA4 traffic…</EmptyState> : trafficError ? <EmptyState>{trafficError}</EmptyState> : <TrafficOverview live={traffic?.configured ? traffic : null} />}
  </section>;
}
