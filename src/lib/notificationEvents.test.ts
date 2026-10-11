import { makeFeedback } from '../test/factories';
import { notificationEvents } from './notificationEvents';

it('shows admins new client feedback and update requests in newest-first order', () => {
  const report = makeFeedback({ id: 'report-1', createdAt: '2026-10-08T10:00:00Z', updateRequestedAt: '2026-10-09T10:00:00Z' });
  expect(notificationEvents([report], true)).toEqual([
    expect.objectContaining({ id: 'requested:report-1:2026-10-09T10:00:00Z', title: 'Update requested' }),
    expect.objectContaining({ id: 'created:report-1', title: 'New feedback' }),
  ]);
});

it('does not announce a Sentry-created report as new client feedback', () => {
  expect(notificationEvents([makeFeedback({ sentryIssueId: 'sentry-1' })], true)).toEqual([]);
});

it('shows only admin activity to a client and creates a new unread identity for each later change', () => {
  const report = makeFeedback({ adminActivityAt: '2026-10-09T11:00:00Z', status: 'ASSIGNED' });
  const first = notificationEvents([report], false);
  const second = notificationEvents([{ ...report, adminActivityAt: '2026-10-09T12:00:00Z', status: 'CLOSED' }], false);
  expect(first).toEqual([expect.objectContaining({ title: 'Your report was updated', detail: expect.stringContaining('Assigned') }), expect.objectContaining({ kind: 'submitted', id: `created:${report.id}` })]);
  expect(second[0].id).not.toBe(first[0].id);
  expect(second[0].detail).toContain('Done');
});
