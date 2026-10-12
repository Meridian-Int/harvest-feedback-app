import type { FeedbackEmailKind } from '../email-content';

export interface Report {
  id: string; title: string; reporterEmail: string; reporterName: string;
  company?: string;
  persona?: 'Company' | 'Partner' | 'Operator';
  priority?: 'BLOCKER' | 'BUG' | 'IMPROVEMENT';
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  updateRequestedAt?: string; adminActivityAt?: string; assignee?: string; sentryIssueId?: string;
}
export interface Notice { kind: FeedbackEmailKind; audience: 'client' | 'admin'; report: Report; previousStatus?: Report['status'] }
type Image = Record<string, { S?: string }>;

function reportFrom(image?: Image): Report | null {
  if (!image) return null;
  const get = (field: string) => image[field]?.S;
  const id = get('id'), title = get('title'), reporterEmail = get('reporterEmail'), reporterName = get('reporterName'), status = get('status');
  if (!id || !title || !reporterEmail || !reporterName || !['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'].includes(status ?? '')) return null;
  const rawPriority = get('priority');
  const priority = ['BLOCKER', 'BUG', 'IMPROVEMENT'].includes(rawPriority ?? '') ? rawPriority as Report['priority'] : undefined;
  const rawPersona = get('persona');
  const persona = ['Company', 'Partner', 'Operator'].includes(rawPersona ?? '') ? rawPersona as Report['persona'] : undefined;
  return { company: get('company'), persona, priority, id, title, reporterEmail, reporterName, status: status as Report['status'], updateRequestedAt: get('updateRequestedAt'), adminActivityAt: get('adminActivityAt'), assignee: get('assignee'), sentryIssueId: get('sentryIssueId') };
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
  if (current.status !== previous.status || (current.adminActivityAt && current.adminActivityAt !== previous.adminActivityAt)) notices.push({
    kind: current.status === 'CLOSED' && previous.status !== 'CLOSED' ? 'closed' : current.status !== previous.status ? 'status-changed' : 'admin-updated', audience: 'client', report: current, previousStatus: previous.status,
  });
  return notices;
}
