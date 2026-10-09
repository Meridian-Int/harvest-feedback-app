import { paginate } from '../../lib/list';
import { Button } from './Button';

export function Pagination({ total, page, onPageChange, label = 'Reports pages' }: {
  total: number; page: number; onPageChange: (page: number) => void; label?: string;
}) {
  const { page: current, pages, start, end } = paginate(Array.from({ length: Math.max(0, total) }), page);
  return <nav className="report-pagination" aria-label={label}>
    <span>{total ? `${start}–${end} of ${total} reports` : '0 reports'}</span>
    <div className="pagination-controls">
      <Button variant="quiet" disabled={current === 1} onClick={() => onPageChange(current - 1)}>Previous</Button>
      <span>Page {current} of {pages}</span>
      <Button variant="quiet" disabled={current === pages} onClick={() => onPageChange(current + 1)}>Next</Button>
    </div>
  </nav>;
}
