import { expect, it } from 'vitest';
import { makeReport } from '../testing/support';
import { displayId, reportPage, STATUS_LABELS, updatePending } from './reports';

it('uses final four uppercase characters', () => { expect(displayId('report-abcd')).toBe('FB-ABCD'); });
it('shows the final status as Done', () => { expect(STATUS_LABELS.CLOSED).toBe('Done'); });
it('sorts by actual time within open/closed groups, filters and paginates six', () => {
  const reports = Array.from({ length: 8 }, (_, index) => makeReport({ id: String(index), createdAt: `2026-10-0${index + 1}T00:00:00Z`, status: index === 7 ? 'CLOSED' : 'NEW' }));
  expect(reportPage(reports, '', 1).rows.map(r => r.id)).toEqual(['6', '5', '4', '3', '2', '1']);
  expect(reportPage(reports, '', 99)).toMatchObject({ page: 2, pages: 2, range: '7–8 of 8 reports' });
  expect(reportPage(reports, 'CLOSED', 9).rows.map(r => r.id)).toEqual(['7']);
  expect(reportPage([], '', -1)).toMatchObject({ page: 1, pages: 1, range: '0 reports' });
  expect(reportPage(reports, '', NaN).page).toBe(1);
  expect(reports[0].id).toBe('0');
});
it('pending means requested after admin activity and never closed', () => {
  const request = '2026-10-09T10:00:00Z';
  expect(updatePending(makeReport())).toBe(false);
  expect(updatePending(makeReport({ updateRequestedAt: request }))).toBe(true);
  expect(updatePending(makeReport({ updateRequestedAt: request, adminActivityAt: request }))).toBe(false);
  expect(updatePending(makeReport({ updateRequestedAt: request, adminActivityAt: '2026-10-09T11:00:00Z' }))).toBe(false);
  expect(updatePending(makeReport({ updateRequestedAt: request, status: 'CLOSED' }))).toBe(false);
});
