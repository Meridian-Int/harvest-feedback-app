import { noticesFor } from '../amplify/functions/feedback-email/events';
type Record = Parameters<typeof noticesFor>[0];
/** Client mail is submission, a server-recorded requested response, or closure. */
export function integrationNoticesFor(record: Record) {
  const old = record.dynamodb?.OldImage, current = record.dynamodb?.NewImage;
  const requested = old?.updateRequestedAt?.S;
  const responded = current?.updateRespondedAt?.S;
  const response = Boolean(requested && responded && responded !== old?.updateRespondedAt?.S &&
    Date.parse(requested) > Date.parse(old?.adminActivityAt?.S ?? '1970-01-01') &&
    Date.parse(responded) > Date.parse(requested) && responded === current?.adminActivityAt?.S);
  return noticesFor(record).filter(notice => notice.audience === 'admin' ||
    notice.kind === 'client-submitted' || notice.kind === 'closed' || response)
    .map(notice => response && notice.audience === 'client' && notice.kind !== 'closed'
      ? { ...notice, kind: 'admin-updated' as const } : notice);
}
