import { displayId } from '../../../lib/format';
import { sortFeedback } from '../../../lib/list';
import type { Feedback, Persona, Priority, Severity, Status } from '../../../lib/types';

export interface ReviewFilters {
  query: string;
  status: Status | '';
  severity: Severity | '';
  productArea: string;
  persona: Persona | '';
  owner: string;
  priority: Priority | 'OPEN' | '';
}

export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  query: '', status: '', severity: '', productArea: '', persona: '', owner: '', priority: '',
};

export function reviewMetrics(reports: readonly Feedback[]) {
  const open = reports.filter(report => report.status !== 'CLOSED');
  return {
    open: open.length,
    blockers: open.filter(report => report.priority === 'BLOCKER').length,
    bugs: open.filter(report => report.priority === 'BUG').length,
    improvements: open.filter(report => report.priority === 'IMPROVEMENT').length,
  };
}

export function filterReviewReports(reports: readonly Feedback[], filters: ReviewFilters): Feedback[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return sortFeedback(reports.filter(report => {
    if (query && ![
      report.title, report.description, report.reporterName, report.reporterEmail,
      report.company, report.id, displayId(report.id),
    ].some(value => value.toLocaleLowerCase().includes(query))) return false;
    if (filters.status && report.status !== filters.status) return false;
    if (filters.severity && report.severity !== filters.severity) return false;
    if (filters.productArea && report.productArea !== filters.productArea) return false;
    if (filters.persona && report.persona !== filters.persona) return false;
    if (filters.owner && (filters.owner === 'unassigned' ? !!report.assignee : report.assignee !== filters.owner)) return false;
    if (filters.priority && (report.status === 'CLOSED' || (filters.priority !== 'OPEN' && report.priority !== filters.priority))) return false;
    return true;
  }));
}

export function readReviewFilters(params: URLSearchParams): ReviewFilters {
  const status = params.get('status') ?? '';
  const severity = params.get('severity') ?? '';
  const persona = params.get('persona') ?? '';
  const priority = params.get('priority') ?? '';
  return {
    query: params.get('q') ?? '',
    status: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'].includes(status) ? status as ReviewFilters['status'] : '',
    severity: ['CRITICAL', 'MEDIUM', 'LOW'].includes(severity) ? severity as ReviewFilters['severity'] : '',
    productArea: params.get('area') ?? '',
    persona: ['Company', 'Partner', 'Operator'].includes(persona) ? persona as ReviewFilters['persona'] : '',
    owner: params.get('owner') ?? '',
    priority: ['OPEN', 'BLOCKER', 'BUG', 'IMPROVEMENT'].includes(priority) ? priority as ReviewFilters['priority'] : '',
  };
}

export function changeReviewFilter(params: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  next.delete('page');
  return next;
}
