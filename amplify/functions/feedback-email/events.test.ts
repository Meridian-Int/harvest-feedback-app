import { expect, it } from 'vitest';
import { noticesFor } from './events';
const image = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, S]) => [key, { S }]));
const report = { id: '1234', title: 'Upload failed', reporterEmail: 'client@example.com', reporterName: 'Client', status: 'NEW' };
it('sends one submission notice to each audience from a committed insert', () => {
  expect(noticesFor({ eventName: 'INSERT', dynamodb: { NewImage: image(report) } }).map(item => item.kind)).toEqual(['client-submitted', 'admin-submitted']);
});
it('notifies administrators only when the update request changes', () => {
  const newReport = { ...report, updateRequestedAt: '2026-10-10T12:00:00Z' };
  expect(noticesFor({ eventName: 'MODIFY', dynamodb: { OldImage: image(report), NewImage: image(newReport) } }).map(item => item.kind)).toEqual(['update-requested']);
  expect(noticesFor({ eventName: 'MODIFY', dynamodb: { OldImage: image(newReport), NewImage: image(newReport) } })).toEqual([]);
});
it.each(['ASSIGNED', 'IN_PROGRESS', 'CLOSED'])('sends exactly one status notice for %s', status => {
  const notices = noticesFor({ eventName: 'MODIFY', dynamodb: { OldImage: image(report), NewImage: image({ ...report, status, adminActivityAt: '2026-10-10T12:00:00Z' }) } });
  expect(notices).toHaveLength(1);
  expect(notices[0].kind).toBe(status === 'CLOSED' ? 'closed' : 'admin-updated');
  expect(notices[0].report.reporterEmail).toBe('client@example.com');
});
it('notifies on an admin change without a status change', () => {
  expect(noticesFor({ eventName: 'MODIFY', dynamodb: { OldImage: image(report), NewImage: image({ ...report, adminActivityAt: 'now' }) } })[0].kind).toBe('admin-updated');
});
it('ignores deletions, malformed records and Sentry-generated reports', () => {
  expect(noticesFor({ eventName: 'REMOVE' })).toEqual([]);
  expect(noticesFor({ eventName: 'INSERT', dynamodb: { NewImage: image({ id: '1' }) } })).toEqual([]);
  expect(noticesFor({ eventName: 'INSERT', dynamodb: { NewImage: image({ ...report, sentryIssueId: 'sentry' }) } })).toEqual([]);
});
