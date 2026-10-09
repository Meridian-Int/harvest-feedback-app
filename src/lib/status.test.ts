import { isUpdatePending, statusStep } from './status';
import { STATUS_ORDER } from './options';
import { makeFeedback } from '../test/factories';

it('maps all four statuses to the progress track', () => { expect(STATUS_ORDER.map(statusStep)).toEqual([0, 1, 2, 3]); });
it('considers requests pending only until the next admin activity', () => {
  const report = makeFeedback({ updateRequestedAt: '2026-10-08T16:00:00Z' });
  expect(isUpdatePending(report)).toBe(true);
  expect(isUpdatePending({ ...report, adminActivityAt: '2026-10-08T15:00:00Z' })).toBe(true);
  expect(isUpdatePending({ ...report, adminActivityAt: '2026-10-08T16:00:00Z' })).toBe(false);
  expect(isUpdatePending({ ...report, adminActivityAt: '2026-10-08T17:00:00Z' })).toBe(false);
  expect(isUpdatePending({ ...report, status: 'CLOSED' })).toBe(false);
  expect(isUpdatePending(makeFeedback())).toBe(false);
});
