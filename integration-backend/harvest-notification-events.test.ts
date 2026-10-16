import { expect, it } from 'vitest';
import { harvestNotificationFor } from './harvest-notification-events';

const report = { id: '62399b4e-5f58-472f-a209-d7901136086b', title: 'Export failed', reporterEmail: 'client@example.com', reporterName: 'Client', company: 'Northstar', status: 'NEW' };
const image = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([key, S]) => [key, { S }]));

it('sends a new client report to HARVEST without personal details', () => {
  const event = harvestNotificationFor({ eventID: 'stream-1', eventName: 'INSERT', dynamodb: { NewImage: image(report) } });
  expect(event).toMatchObject({ kind: 'feedback.created', reportId: report.id, company: 'Northstar', title: 'Export failed' });
  expect(event?.eventId).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(event)).not.toContain(report.reporterEmail);
});

it('sends update requests but ignores admin updates and Sentry reports', () => {
  const old = image(report);
  expect(harvestNotificationFor({ eventID: 'stream-2', eventName: 'MODIFY', dynamodb: { OldImage: old, NewImage: image({ ...report, updateRequestedAt: '2026-10-15T12:00:00Z' }) } })?.kind).toBe('feedback.update_requested');
  expect(harvestNotificationFor({ eventID: 'stream-3', eventName: 'MODIFY', dynamodb: { OldImage: old, NewImage: image({ ...report, status: 'ASSIGNED', adminActivityAt: '2026-10-15T12:00:00Z' }) } })).toBeNull();
  expect(harvestNotificationFor({ eventID: 'stream-4', eventName: 'INSERT', dynamodb: { NewImage: image({ ...report, sentryIssueId: '1' }) } })).toBeNull();
});
