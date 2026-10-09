import { STATUS_ORDER } from './options';
import type { Feedback, Status } from './types';

export function statusStep(status: Status): number {
  return STATUS_ORDER.indexOf(status);
}

export function isUpdatePending(report: Pick<Feedback, 'status' | 'updateRequestedAt' | 'adminActivityAt'>): boolean {
  return report.status !== 'CLOSED' && Boolean(report.updateRequestedAt) &&
    Date.parse(report.updateRequestedAt!) > (report.adminActivityAt ? Date.parse(report.adminActivityAt) : 0);
}
