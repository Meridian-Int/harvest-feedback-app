import { createHash } from 'node:crypto';
import { integrationNoticesFor } from './email-events';

type StreamRecord = Parameters<typeof integrationNoticesFor>[0] & { eventID?: string };

/** Only the two events visible to Feedback admins enter HARVEST's bell. */
export function harvestNotificationFor(record: StreamRecord) {
  if (!record.eventID) throw new Error('Feedback stream event has no delivery identity.');
  const notice = integrationNoticesFor(record).find(item => item.audience === 'admin' &&
    (item.kind === 'admin-submitted' || item.kind === 'update-requested'));
  if (!notice) return null;
  return {
    eventId: createHash('sha256').update(`${record.eventID}:${notice.kind}`).digest('hex'),
    kind: notice.kind === 'admin-submitted' ? 'feedback.created' as const : 'feedback.update_requested' as const,
    reportId: notice.report.id,
    company: notice.report.company ?? '',
    title: notice.report.title,
  };
}
