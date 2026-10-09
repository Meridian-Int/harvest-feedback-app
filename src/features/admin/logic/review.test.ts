import { expect, it } from 'vitest';
import { makeFeedback } from '../../../test/factories';
import { changeReviewFilter, EMPTY_REVIEW_FILTERS, filterReviewReports, readReviewFilters, reviewMetrics } from './review';

const reports = [
  makeFeedback({ id: 'report-a001', title: 'Payout missing', description: 'No receipt arrived', productArea: 'Payment — failed or missing payout', priority: 'BLOCKER', severity: 'CRITICAL', reporterName: 'Asha', company: 'Acme', persona: 'Company', assignee: 'admin@example.com', createdAt: '2026-10-01T00:00:00Z' }),
  makeFeedback({ id: 'report-b002', title: 'Upload issue', description: 'Data room upload stalled', productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM', reporterName: 'Ben', company: 'Beta', persona: 'Partner', createdAt: '2026-10-08T00:00:00Z' }),
  makeFeedback({ id: 'report-c003', title: 'Improve console', description: 'Faster search', productArea: 'Operations console', priority: 'IMPROVEMENT', severity: 'LOW', reporterName: 'Cara', company: 'Meridian', persona: 'Operator', status: 'CLOSED', createdAt: '2026-10-09T00:00:00Z' }),
];

it('counts every open report before any search or filters', () => {
  expect(reviewMetrics(reports)).toEqual({ open: 2, blockers: 1, bugs: 1, improvements: 0 });
});

it.each(['Payout', 'receipt', 'Asha', 'Acme', 'report-a001', 'FB-A001'])('searches title, body, reporter, company and ID: %s', query => {
  expect(filterReviewReports(reports, { ...EMPTY_REVIEW_FILTERS, query: query.toLowerCase() }).map(report => report.id)).toEqual(['report-a001']);
});

it('applies status, severity, area, persona and owner filters together', () => {
  const filters = { ...EMPTY_REVIEW_FILTERS, status: 'NEW' as const, severity: 'CRITICAL' as const,
    productArea: 'Payment — failed or missing payout', persona: 'Company' as const, owner: 'admin@example.com' };
  expect(filterReviewReports(reports, filters).map(report => report.id)).toEqual(['report-a001']);
  expect(filterReviewReports(reports, { ...EMPTY_REVIEW_FILTERS, owner: 'unassigned' }).map(report => report.id)).toEqual(['report-b002', 'report-c003']);
});

it('uses metric selection as an open report priority filter and sorts closed reports last', () => {
  expect(filterReviewReports(reports, { ...EMPTY_REVIEW_FILTERS, priority: 'OPEN' })).toHaveLength(2);
  expect(filterReviewReports(reports, { ...EMPTY_REVIEW_FILTERS, priority: 'IMPROVEMENT' })).toHaveLength(0);
  expect(filterReviewReports(reports, EMPTY_REVIEW_FILTERS).map(report => report.id)).toEqual(['report-b002', 'report-a001', 'report-c003']);
});

it('reads valid URL filters, ignores invalid choices and resets page on a filter change', () => {
  const params = new URLSearchParams('q=payout&status=NEW&severity=bad&persona=Partner&priority=BUG&page=3&report=abc');
  expect(readReviewFilters(params)).toMatchObject({ query: 'payout', status: 'NEW', severity: '', persona: 'Partner', priority: 'BUG' });
  const next = changeReviewFilter(params, 'area', 'Data room');
  expect(next.get('area')).toBe('Data room');
  expect(next.has('page')).toBe(false);
  expect(next.get('report')).toBe('abc');
  expect(params.has('page')).toBe(true);
});
