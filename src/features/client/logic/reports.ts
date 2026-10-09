import type { Feedback } from '../contract';

export const STATUS_LABELS = { NEW: 'New', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', CLOSED: 'Closed' } as const;
export const displayId = (id: string) => `FB-${id.slice(-4).toUpperCase()}`;
export function updatePending(report: Feedback): boolean {
  return report.status !== 'CLOSED' && !!report.updateRequestedAt && Date.parse(report.updateRequestedAt) > (report.adminActivityAt ? Date.parse(report.adminActivityAt) : 0);
}
export function reportPage(reports: Feedback[], status: string, requested: number) {
  const sorted = reports.filter(r => !status || r.status === status).sort((a, b) => Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED') || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const pages = Math.max(1, Math.ceil(sorted.length / 6));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const start = (page - 1) * 6;
  const rows = sorted.slice(start, start + 6);
  return { rows, page, pages, total: sorted.length, range: sorted.length ? `${start + 1}–${start + rows.length} of ${sorted.length} reports` : '0 reports' };
}
