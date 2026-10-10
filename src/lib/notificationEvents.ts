import { STATUS_LABELS } from './options';
import type { Feedback } from './types';

export interface NotificationEvent {
  id: string;
  reportId: string;
  kind: 'created' | 'requested' | 'updated';
  title: string;
  detail: string;
  time: string;
}

/** Build the events visible to this role from reports already authorized by AppSync. */
export function notificationEvents(reports: Feedback[], admin: boolean): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  for (const report of reports) {
    if (admin) {
      if (!report.sentryIssueId) events.push({
        id: `created:${report.id}`,
        reportId: report.id,
        kind: 'created',
        title: 'New feedback',
        detail: `${report.company} · ${report.title}`,
        time: report.createdAt,
      });
      if (report.updateRequestedAt) events.push({
        id: `requested:${report.id}:${report.updateRequestedAt}`,
        reportId: report.id,
        kind: 'requested',
        title: 'Update requested',
        detail: `${report.company} · ${report.title}`,
        time: report.updateRequestedAt,
      });
    } else if (report.adminActivityAt) {
      events.push({
        id: `updated:${report.id}:${report.adminActivityAt}`,
        reportId: report.id,
        kind: 'updated',
        title: 'Your report was updated',
        detail: `${report.title} · ${STATUS_LABELS[report.status]}`,
        time: report.adminActivityAt,
      });
    }
  }
  return events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}
