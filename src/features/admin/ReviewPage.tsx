import { useEffect, useState } from 'react';
import { Button, EmptyState, Input, MetricToggle, Pagination, Panel, Pill, SegmentedControl, Select, Tag, Toast } from '../../components/ui';
import { Icon } from '../../components/icons';
import { listAllFeedback, observeAllFeedback } from '../../lib/feedback';
import { formatDate } from '../../lib/format';
import { paginate } from '../../lib/list';
import { ASSIGNEES, PERSONAS, PRODUCT_AREAS, SEVERITIES, STATUSES, STATUS_LABELS, STATUS_ORDER } from '../../lib/options';
import { isUpdatePending, statusStep } from '../../lib/status';
import type { Feedback } from '../../lib/types';
import { changeReviewFilter, filterReviewReports, readReviewFilters, reviewMetrics } from './logic/review';
import { ReviewDetail } from './ReviewDetail';
import { useSearchParams } from 'react-router-dom';
import './review.css';

type Layout = 'list' | 'grid';

function ReportRow({ report, onOpen }: { report: Feedback; onOpen: () => void }) {
  const currentStep = statusStep(report.status);
  return <button type="button" className="admin-report" onClick={onOpen} aria-label={`View description: ${report.title}`} aria-description={`Status: ${STATUS_LABELS[report.status]}`}>
    <span className="admin-row-main">
      <span className="admin-heading-line"><span className="admin-report-title">{report.title}</span><span className="admin-report-date">{formatDate(report.createdAt)}</span></span>
      <small>{report.productArea} · {report.company}{report.status === 'CLOSED' ? ' · Closed' : ''}{isUpdatePending(report) ? ' · Update requested' : ''}</small>
      <span className="admin-progress" aria-hidden="true">{STATUS_ORDER.map((step, index) => {
        const completed = index < currentStep || report.status === 'CLOSED';
        return <span key={step} className={`admin-progress-step ${completed ? 'completed' : index === currentStep ? 'current' : 'future'}`}>
          <span className="admin-progress-dot">{completed ? <Icon name="check" /> : index + 1}</span>
          <span>{STATUS_LABELS[step]}</span>
        </span>;
      })}</span>
    </span>
    <span className="admin-report-badges"><Pill value={report.priority} /><Pill value={report.severity} /></span>
    <span className="admin-report-arrow" aria-hidden="true" />
  </button>;
}

export function ReviewPage() {
  const [params, setParams] = useSearchParams();
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>(() => localStorage.getItem('harvest-admin-view') === 'grid' ? 'grid' : 'list');
  const filters = readReviewFilters(params);
  const metrics = reviewMetrics(reports);
  const visible = filterReviewReports(reports, filters);
  const page = paginate(visible, Number(params.get('page') || 1));
  const selected = reports.find(report => report.id === params.get('report'));

  useEffect(() => {
    let active = true;
    let streamRevision = 0;
    async function refresh() {
      const revision = streamRevision;
      try {
        const rows = await listAllFeedback();
        if (active && revision === streamRevision) { setReports(rows); setError(null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load reports.');
      } finally {
        if (active) setLoading(false);
      }
    }
    let stop = () => {};
    try {
      stop = observeAllFeedback(rows => {
        if (active) { streamRevision += 1; setReports(rows); setError(null); setLoading(false); }
      }, cause => { if (active) { setError(cause.message); setLoading(false); } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load reports.');
    }
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { active = false; stop(); window.removeEventListener('focus', refresh); };
  }, []);

  function updateFilter(key: string, value: string) { setParams(changeReviewFilter(params, key, value), { replace: true }); }
  function updateLayout(value: Layout) { setLayout(value); localStorage.setItem('harvest-admin-view', value); }
  function openReport(id: string) { const next = new URLSearchParams(params); next.set('report', id); setParams(next); }
  function closeReport() { const next = new URLSearchParams(params); next.delete('report'); setParams(next); }

  return <section className="report-page" id="view-admin">
    <div className="pagehead"><div><h1>Feedback review</h1><p>Review, assign and respond to client reports.</p></div><Tag>Admin</Tag></div>
    <div className="admin-stats">
      {([
        ['OPEN', 'Open', metrics.open, 'Across every product area'],
        ['BLOCKER', 'Blockers', metrics.blockers, 'Work cannot continue'],
        ['BUG', 'Bugs', metrics.bugs, 'Something is not working'],
        ['IMPROVEMENT', 'Improvements', metrics.improvements, 'Ideas to make it better'],
      ] as const).map(([value, label, count, helper]) => <MetricToggle key={value} label={label} count={count} helper={helper} selected={filters.priority === value} onClick={() => updateFilter('priority', filters.priority === value ? '' : value)} />)}
    </div>
    <Panel className="admin-review-panel">
      <div className="admin-filters">
        <Input type="search" aria-label="Search reports" placeholder="Search report, company or reporter" value={filters.query} onChange={event => updateFilter('q', event.target.value)} />
        <Select aria-label="Filter status" value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="">All statuses</option>{STATUS_ORDER.map((value, index) => <option key={value} value={value}>{STATUSES[index]}</option>)}</Select>
        <Select aria-label="Filter severity" value={filters.severity} onChange={event => updateFilter('severity', event.target.value)}><option value="">All severities</option>{(['CRITICAL', 'MEDIUM', 'LOW'] as const).map((value, index) => <option key={value} value={value}>{SEVERITIES[index]}</option>)}</Select>
        <Select aria-label="Filter product area" value={filters.productArea} onChange={event => updateFilter('area', event.target.value)}><option value="">All product areas</option>{PRODUCT_AREAS.map(value => <option key={value} value={value}>{value}</option>)}</Select>
        <Select aria-label="Filter persona" value={filters.persona} onChange={event => updateFilter('persona', event.target.value)}><option value="">All personas</option>{PERSONAS.map(value => <option key={value} value={value}>{value}</option>)}</Select>
        <Select aria-label="Filter owner" value={filters.owner} onChange={event => updateFilter('owner', event.target.value)}><option value="">All owners</option><option value="unassigned">Unassigned</option>{ASSIGNEES.filter(item => item.value).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
        <Button variant="quiet" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Reset</Button>
      </div>
      <div className="admin-list-bar"><span className="admin-count">{visible.length} reports</span><SegmentedControl label="Admin report layout" options={[{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }]} value={layout} onChange={updateLayout} compact /></div>
      <div className="report-collection admin-reports" data-view={layout}>
        {loading ? <EmptyState>Loading reports…</EmptyState> : error ? <EmptyState>{error}</EmptyState> : page.items.length ? page.items.map(report => <ReportRow key={report.id} report={report} onOpen={() => openReport(report.id)} />) : <EmptyState>No reports match these filters.</EmptyState>}
      </div>
      <Pagination total={visible.length} page={page.page} onPageChange={value => { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next); }} label="Admin reports pages" />
    </Panel>
    {selected && <ReviewDetail key={selected.id} report={selected} onClose={closeReport} onSaved={updated => { setReports(current => current.map(report => report.id === updated.id ? updated : report)); setToast('Report updated.'); }} />}
    <Toast message={toast} onDismiss={() => setToast(null)} />
  </section>;
}
