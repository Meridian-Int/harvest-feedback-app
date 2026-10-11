import type { FeedbackEmailKind } from '../email-content';

export interface Report {
  id: string; title: string; reporterEmail: string; reporterName: string;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  updateRequestedAt?: string; adminActivityAt?: string; assignee?: string; sentryIssueId?: string;
}
export interface Notice { kind: FeedbackEmailKind; audience: 'client' | 'admin'; report: Report }
type Image = Record<string, { S?: string }>;

function reportFrom(image?: Image): Report | null {
  if (!image) return null;
  const get = (field: string) => image[field]?.S;
  const id = get('id'), title = get('title'), reporterEmail = get('reporterEmail'), reporterName = get('reporterName'), status = get('status');
  if (!id || !title || !reporterEmail || !reporterName || !['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'].includes(status ?? '')) return null;
  return { id, title, reporterEmail, reporterName, status: status as Report['status'], updateRequestedAt: get('updateRequestedAt'), adminActivityAt: get('adminActivityAt'), assignee: get('assignee'), sentryIssueId: get('sentryIssueId') };
}

/** Derive notices from committed server records, never browser-supplied recipients. */
export function noticesFor(record: { eventName?: string; dynamodb?: { NewImage?: Image; OldImage?: Image } }): Notice[] {
  const current = reportFrom(record.dynamodb?.NewImage);
  if (!current || current.sentryIssueId) return [];
  if (record.eventName === 'INSERT') return [
    { kind: 'client-submitted', audience: 'client', report: current },
    { kind: 'admin-submitted', audience: 'admin', report: current },
  ];
  const previous = reportFrom(record.dynamodb?.OldImage);
  if (record.eventName !== 'MODIFY' || !previous) return [];
  const notices: Notice[] = [];
  if (current.updateRequestedAt && current.updateRequestedAt !== previous.updateRequestedAt) notices.push({ kind: 'update-requested', audience: 'admin', report: current });
  if (current.status !== previous.status || current.assignee !== previous.assignee || (current.adminActivityAt && current.adminActivityAt !== previous.adminActivityAt)) notices.push({
    kind: current.status === 'CLOSED' && previous.status !== 'CLOSED' ? 'closed' : 'admin-updated', audience: 'client', report: current,
  });
  return notices;
}
