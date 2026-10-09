import { paginate, sortFeedback } from './list';
import { makeFeedback } from '../test/factories';

it('sorts newest first within open and closed groups without mutating its input', () => {
  const items = [makeFeedback({ id: 'old', createdAt: '2026-10-01' }), makeFeedback({ id: 'closed', status: 'CLOSED', createdAt: '2026-10-09' }), makeFeedback({ id: 'new', createdAt: '2026-10-08' })];
  expect(sortFeedback(items).map(r => r.id)).toEqual(['new', 'old', 'closed']); expect(items[0].id).toBe('old');
});
it('paginates six records and clamps pages at both ends', () => {
  const items = Array.from({ length: 13 }, (_, i) => i);
  expect(paginate(items, 1).items).toEqual([0, 1, 2, 3, 4, 5]);
  expect(paginate(items, 99)).toMatchObject({ page: 3, pages: 3, items: [12], start: 13, end: 13 });
  expect(paginate(items, -9).page).toBe(1); expect(paginate(items, NaN).page).toBe(1);
});
it('handles no results and invalid page sizes', () => {
  expect(paginate([], 9)).toMatchObject({ page: 1, pages: 1, start: 0, end: 0, range: '0 reports' });
  expect(paginate([1, 2], 1, 0).items).toEqual([1, 2]); expect(paginate([1, 2], 2, -2).items).toEqual([2]);
});
