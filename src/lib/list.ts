import { REPORT_PAGE_SIZE } from './options';
import type { Feedback } from './types';

export function sortFeedback<T extends Pick<Feedback, 'status' | 'createdAt'>>(reports: readonly T[]): T[] {
  return [...reports].sort((a, b) => Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED') ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function paginate<T>(items: readonly T[], requestedPage: number, pageSize = REPORT_PAGE_SIZE) {
  const size = Math.max(1, Math.trunc(pageSize) || REPORT_PAGE_SIZE);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(1, Math.min(pages, Math.trunc(requestedPage) || 1));
  const start = total ? (page - 1) * size + 1 : 0;
  const end = Math.min(page * size, total);
  return { items: items.slice((page - 1) * size, page * size), page, pages, total, start, end,
    range: total ? `${start}–${end} of ${total} reports` : '0 reports' };
}
